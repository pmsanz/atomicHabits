import { useState } from "react";
import {
  useListHabits,
  useCreateHabit,
  useDeleteHabit,
  useUpdateHabit,
  getListHabitsQueryKey,
  useListIdentities,
  type Habit,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2 } from "lucide-react";

const habitSchema = z.object({
  name: z.string().min(1),
  identityId: z.coerce.number().optional(),
  habitType: z.enum(["BOOLEAN", "QUANTITY", "DURATION"]),
  frequency: z.enum(["DAILY", "WEEKLY", "CUSTOM"]),
  minimumVersion: z.string().optional(),
  idealVersion: z.string().optional(),
  cueType: z.enum(["TIME", "LOCATION", "EVENT", "PERSON", "NONE"]).optional(),
  cueDescription: z.string().optional(),
});

type HabitFormValues = z.infer<typeof habitSchema>;

function HabitForm({
  defaultValues,
  identities,
  onSubmit,
  isPending,
  submitLabel,
}: {
  defaultValues: Partial<HabitFormValues>;
  identities: { id: number; name: string }[] | undefined;
  onSubmit: (data: HabitFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const form = useForm<HabitFormValues>({
    resolver: zodResolver(habitSchema),
    defaultValues: {
      name: "",
      habitType: "BOOLEAN",
      frequency: "DAILY",
      minimumVersion: "",
      idealVersion: "",
      cueType: "NONE",
      cueDescription: "",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input placeholder="Read every day" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="identityId" render={({ field }) => (
          <FormItem>
            <FormLabel>Target Identity (Optional)</FormLabel>
            <Select onValueChange={field.onChange} value={field.value?.toString()}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select an identity" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="-1">None</SelectItem>
                {identities?.map(id => (
                  <SelectItem key={id.id} value={id.id.toString()}>{id.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="habitType" render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="BOOLEAN">Yes / No</SelectItem>
                  <SelectItem value="QUANTITY">Quantity</SelectItem>
                  <SelectItem value="DURATION">Duration</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="frequency" render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="minimumVersion" render={({ field }) => (
            <FormItem>
              <FormLabel>Minimum Version</FormLabel>
              <FormControl><Input placeholder="Read 1 page" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="idealVersion" render={({ field }) => (
            <FormItem>
              <FormLabel>Ideal Version</FormLabel>
              <FormControl><Input placeholder="Read 20 pages" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="cueDescription" render={({ field }) => (
          <FormItem>
            <FormLabel>Implementation Intention (Cue)</FormLabel>
            <FormControl><Input placeholder="After making coffee..." {...field} /></FormControl>
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
      </form>
    </Form>
  );
}

export default function Habits() {
  const queryClient = useQueryClient();
  const { data: habits, isLoading } = useListHabits();
  const { data: identities } = useListIdentities();
  const createMutation = useCreateHabit();
  const deleteMutation = useDeleteHabit();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const updateMutation = useUpdateHabit(editingHabit?.id ?? 0);

  const handleCreate = (data: HabitFormValues) => {
    const payload = { ...data, identityId: data.identityId === -1 ? undefined : data.identityId };
    createMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
        setIsCreateOpen(false);
      },
    });
  };

  const handleEdit = (data: HabitFormValues) => {
    if (!editingHabit) return;
    const payload = { ...data, identityId: data.identityId === -1 ? undefined : data.identityId };
    updateMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
        setEditingHabit(null);
      },
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() }),
      });
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
          <p className="text-muted-foreground text-sm mt-1">Design the systems that build your identity.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Habit
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Create Habit</DialogTitle></DialogHeader>
          <HabitForm
            defaultValues={{ habitType: "BOOLEAN", frequency: "DAILY", cueType: "NONE" }}
            identities={identities}
            onSubmit={handleCreate}
            isPending={createMutation.isPending}
            submitLabel="Create Habit"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingHabit} onOpenChange={(open) => { if (!open) setEditingHabit(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit Habit</DialogTitle></DialogHeader>
          {editingHabit && (
            <HabitForm
              key={editingHabit.id}
              defaultValues={{
                name: editingHabit.name,
                identityId: editingHabit.identityId ?? undefined,
                habitType: editingHabit.habitType as "BOOLEAN" | "QUANTITY" | "DURATION",
                frequency: editingHabit.frequency as "DAILY" | "WEEKLY" | "CUSTOM",
                minimumVersion: editingHabit.minimumVersion ?? "",
                idealVersion: editingHabit.idealVersion ?? "",
                cueType: (editingHabit.cueType as "TIME" | "LOCATION" | "EVENT" | "PERSON" | "NONE") ?? "NONE",
                cueDescription: editingHabit.cueDescription ?? "",
              }}
              identities={identities}
              onSubmit={handleEdit}
              isPending={updateMutation.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {habits?.length === 0 ? (
        <Card className="border-dashed bg-transparent">
          <CardContent className="p-12 text-center text-muted-foreground">
            Create your first habit. Make it small enough that you can do it even on a bad day.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {habits?.map(habit => (
            <Card key={habit.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg pr-2">{habit.name}</CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setEditingHabit(habit)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => handleDelete(habit.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {habit.identityName && (
                  <div className="text-xs text-primary font-medium mt-1 uppercase tracking-wider">
                    {habit.identityName}
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 pb-2">
                <div className="space-y-2 text-sm">
                  {habit.minimumVersion && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground w-12 shrink-0">Min:</span>
                      <span>{habit.minimumVersion}</span>
                    </div>
                  )}
                  {habit.idealVersion && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground w-12 shrink-0">Ideal:</span>
                      <span>{habit.idealVersion}</span>
                    </div>
                  )}
                  {habit.cueDescription && (
                    <div className="flex items-start gap-2 mt-4 pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Cue:</span>
                      <span className="italic">{habit.cueDescription}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
