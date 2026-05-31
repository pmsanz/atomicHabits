import { useState } from "react";
import {
  useListHabits,
  useListHabitStacks,
  useCreateHabitStack,
  useUpdateHabitStack,
  useDeleteHabitStack,
  getListHabitStacksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, ArrowRight } from "lucide-react";

const stackSchema = z.object({
  anchorHabitId: z.coerce.number().optional(),
  anchorDescription: z.string().min(1),
  newHabitId: z.coerce.number().min(1, "Select a habit"),
  stackPhrase: z.string().min(1),
});

type StackFormValues = z.infer<typeof stackSchema>;

function StackForm({
  defaultValues,
  habits,
  onSubmit,
  isPending,
  submitLabel,
}: {
  defaultValues: Partial<StackFormValues>;
  habits: { id: number; name: string }[] | undefined;
  onSubmit: (data: StackFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const form = useForm<StackFormValues>({
    resolver: zodResolver(stackSchema),
    defaultValues: { anchorDescription: "", stackPhrase: "I will", ...defaultValues },
  });

  return (
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
                <SelectItem value="-1">None (custom anchor)</SelectItem>
                {habits?.map(h => (
                  <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name="anchorDescription" render={({ field }) => (
          <FormItem>
            <FormLabel>Anchor Description</FormLabel>
            <FormControl><Input placeholder="make my morning coffee" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
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
        )} />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
      </form>
    </Form>
  );
}

export default function Stacks() {
  const queryClient = useQueryClient();
  const { data: stacks, isLoading: loadingStacks } = useListHabitStacks();
  const { data: habits, isLoading: loadingHabits } = useListHabits();
  const createMutation = useCreateHabitStack();
  const deleteMutation = useDeleteHabitStack();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingStackId, setEditingStackId] = useState<number | null>(null);

  const editingStack = stacks?.find(s => s.id === editingStackId) ?? null;
  const updateMutation = useUpdateHabitStack(editingStackId ?? 0);

  const handleCreate = (data: StackFormValues) => {
    const payload = { ...data, anchorHabitId: data.anchorHabitId === -1 ? undefined : data.anchorHabitId };
    createMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHabitStacksQueryKey() });
        setIsCreateOpen(false);
      },
    });
  };

  const handleEdit = (data: StackFormValues) => {
    if (!editingStackId) return;
    const payload = { ...data, anchorHabitId: data.anchorHabitId === -1 ? undefined : data.anchorHabitId };
    updateMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHabitStacksQueryKey() });
        setEditingStackId(null);
      },
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this stack?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListHabitStacksQueryKey() }),
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
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Stack
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Create Habit Stack</DialogTitle></DialogHeader>
          <StackForm
            defaultValues={{ stackPhrase: "I will" }}
            habits={habits}
            onSubmit={handleCreate}
            isPending={createMutation.isPending}
            submitLabel="Save Stack"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingStackId} onOpenChange={(open) => { if (!open) setEditingStackId(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Edit Habit Stack</DialogTitle></DialogHeader>
          {editingStack && (
            <StackForm
              key={editingStack.id}
              defaultValues={{
                anchorHabitId: editingStack.anchorHabitId ?? -1,
                anchorDescription: editingStack.anchorDescription,
                newHabitId: editingStack.newHabitId,
                stackPhrase: editingStack.stackPhrase,
              }}
              habits={habits}
              onSubmit={handleEdit}
              isPending={updateMutation.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

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
                <div className="flex gap-1 ml-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setEditingStackId(stack.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => handleDelete(stack.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
