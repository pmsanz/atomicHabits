import { useState } from "react";
import { 
  useListIdentities, 
  useCreateIdentity, 
  useDeleteIdentity,
  getListIdentitiesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Fingerprint } from "lucide-react";

const identitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  colorKey: z.enum(["green", "blue", "violet", "amber", "rose", "teal"]).optional(),
});

const colorMap: Record<string, string> = {
  green: "bg-green-500/10 text-green-500 border-green-500/20",
  blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  violet: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  rose: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  teal: "bg-teal-500/10 text-teal-500 border-teal-500/20",
};

export default function Identities() {
  const queryClient = useQueryClient();
  const { data: identities, isLoading } = useListIdentities();
  const createMutation = useCreateIdentity();
  const deleteMutation = useDeleteIdentity();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof identitySchema>>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      name: "",
      description: "",
      colorKey: "green",
    }
  });

  const onSubmit = (data: z.infer<typeof identitySchema>) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIdentitiesQueryKey() });
        setIsDialogOpen(false);
        form.reset();
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure? Deleting this identity will detach it from its habits.")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListIdentitiesQueryKey() })
      });
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Identities</h1>
          <p className="text-muted-foreground text-sm mt-1">Define the person you want to become.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2"/> New Identity</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Identity</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input placeholder="I am a consistent reader" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Why is this important?" {...field} /></FormControl>
                  </FormItem>
                )}/>
                <FormField control={form.control} name="colorKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Accent</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.keys(colorMap).map(color => (
                          <SelectItem key={color} value={color} className="capitalize">
                            {color}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}/>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {identities?.length === 0 ? (
        <Card className="border-dashed bg-transparent">
          <CardContent className="p-12 text-center text-muted-foreground">
            No identities defined. Start by claiming who you want to be.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {identities?.map(identity => {
            const colorClass = identity.colorKey ? colorMap[identity.colorKey] || colorMap.green : colorMap.green;
            return (
              <Card key={identity.id} className="relative overflow-hidden group">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorClass.split(' ')[0]}`} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Fingerprint className={`w-4 h-4 ${colorClass.split(' ')[1]}`} />
                      {identity.name}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(identity.id)} className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {identity.description && (
                    <CardDescription className="text-sm mt-1">{identity.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mt-4 text-sm border-t border-border/50 pt-4">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Habits</span>
                      <span className="font-mono font-medium">{identity.habitCount || 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Evidence</span>
                      <span className="font-mono font-medium">{identity.evidenceCount || 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Consistency</span>
                      <span className="font-mono font-medium text-primary">
                        {identity.consistencyScore ? `${(identity.consistencyScore * 100).toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
