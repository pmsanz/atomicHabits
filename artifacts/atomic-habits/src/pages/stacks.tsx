import { useState } from "react";
import { 
  useListHabits, 
  useListHabitStacks, 
  useCreateHabitStack, 
  useDeleteHabitStack,
  getListHabitStacksQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowRight } from "lucide-react";

const stackSchema = z.object({
  anchorHabitId: z.coerce.number().optional(),
  anchorDescription: z.string().min(1),
  newHabitId: z.coerce.number().min(1, "Select a habit"),
  stackPhrase: z.string().min(1),
});

export default function Stacks() {
  const queryClient = useQueryClient();
  const { data: stacks, isLoading: loadingStacks } = useListHabitStacks();
  const { data: habits, isLoading: loadingHabits } = useListHabits();
  const createMutation = useCreateHabitStack();
  const deleteMutation = useDeleteHabitStack();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof stackSchema>>({
    resolver: zodResolver(stackSchema),
    defaultValues: {
      anchorDescription: "",
      stackPhrase: "I will",
    }
  });

  const onSubmit = (data: z.infer<typeof stackSchema>) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHabitStacksQueryKey() });
        setIsDialogOpen(false);
        form.reset();
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this stack?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListHabitStacksQueryKey() })
      });
    }
  };

  if (loadingStacks || loadingHabits) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Habit Stacks</h1>
          <p className="text-muted-foreground text-sm mt-1">Tie new habits to existing behaviors.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2"/> New Stack</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Habit Stack</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="anchorHabitId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>After I... (Anchor Habit)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an existing habit or leave empty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None (custom anchor)</SelectItem>
                        {habits?.map(h => (
                          <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}/>
                <FormField control={form.control} name="anchorDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anchor Description</FormLabel>
                    <FormControl><Input placeholder="make my morning coffee" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <div className="text-center font-serif italic text-muted-foreground my-2">I will...</div>
                <FormField control={form.control} name="newHabitId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Habit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a habit to stack" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {habits?.map(h => (
                          <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save Stack"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {stacks?.length === 0 ? (
        <Card className="border-dashed bg-transparent">
          <CardContent className="p-12 text-center text-muted-foreground">
            No habit stacks yet. Create one by pairing a new habit with an existing routine.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {stacks?.map(stack => (
            <Card key={stack.id} className="relative group">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-1 text-right">
                    <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">After I</p>
                    <p className="font-medium text-lg">
                      {stack.anchorHabitName ? stack.anchorHabitName : stack.anchorDescription}
                    </p>
                  </div>
                  <div className="w-12 flex justify-center text-primary/50">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">I will</p>
                    <p className="font-medium text-lg text-primary">{stack.newHabitName}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(stack.id)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-4 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
