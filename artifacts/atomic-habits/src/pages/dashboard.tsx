import { useAuth } from "@/lib/auth-context";
import {
  useGetDashboardToday,
  useGetDashboardHeatmap,
  useCreateHabitLog,
  getGetDashboardTodayQueryKey,
  getGetDashboardHeatmapQueryKey,
  Habit
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Heatmap() {
  const { data: heatmapData, isLoading } = useGetDashboardHeatmap();
  
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!heatmapData || heatmapData.length === 0) return null;

  // Simple Github-style heatmap: Group by weeks
  const weeks: { [key: string]: typeof heatmapData } = {};
  heatmapData.forEach(day => {
    // Basic grouping (just for visualization)
    const week = format(new Date(day.date), 'w');
    if (!weeks[week]) weeks[week] = [];
    weeks[week].push(day);
  });

  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-sm font-medium">Consistency</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {Object.values(weeks).map((week, i) => (
            <div key={i} className="flex flex-col gap-1">
              {week.map((day) => {
                let colorClass = "bg-muted";
                if (day.rate > 0) colorClass = "bg-primary/20";
                if (day.rate >= 0.5) colorClass = "bg-primary/60";
                if (day.rate >= 0.8) colorClass = "bg-primary";
                
                return (
                  <div
                    key={day.date}
                    className={`w-3 h-3 rounded-sm ${colorClass}`}
                    title={`${day.date}: ${day.count}/${day.total}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: today, isLoading } = useGetDashboardToday();
  const logMutation = useCreateHabitLog();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const toggleHabit = (habit: Habit, completed: boolean) => {
    logMutation.mutate({
      data: {
        habitId: habit.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        completed
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardHeatmapQueryKey() });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting()}, {user?.name}</h1>
          {today && (
            <p className="text-muted-foreground mt-1">
              You've completed {today.completedHabits} of {today.totalHabits} habits today.
            </p>
          )}
        </div>
      </div>

      {today?.neverMissTwice && today.neverMissTwice.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-destructive">Recovery Required</h2>
          {today.neverMissTwice.map((item) => (
            <Card key={item.habitId} className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-destructive">{item.habitName}</h3>
                  <p className="text-sm text-muted-foreground">You missed this yesterday. No guilt. Do the minimum version today and keep the identity alive.</p>
                  {item.minimumVersion && (
                    <p className="text-xs font-mono mt-2 bg-background/50 inline-block px-2 py-1 rounded">Min: {item.minimumVersion}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Today's Protocol</h2>
            {today?.habits && today.habits.length > 0 ? (
              <div className="space-y-2">
                {today.habits.map((habit) => (
                  <Card key={habit.id} className="transition-all hover:border-primary/50">
                    <CardContent className="p-4 flex items-start gap-4">
                      <Checkbox 
                        checked={habit.todayCompleted} 
                        onCheckedChange={(c) => toggleHabit(habit, c as boolean)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className={`font-medium ${habit.todayCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {habit.name}
                          </h3>
                          {habit.streak ? (
                            <span className="text-xs text-primary font-mono">{habit.streak} day streak</span>
                          ) : null}
                        </div>
                        {habit.identityName && (
                          <span className="text-xs text-muted-foreground mt-1 inline-block px-2 py-0.5 bg-muted rounded-full">
                            I am a {habit.identityName.toLowerCase()}
                          </span>
                        )}
                        {habit.idealVersion && !habit.todayCompleted && (
                          <p className="text-xs text-muted-foreground mt-2 border-l-2 pl-2">
                            {habit.idealVersion}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No habits yet. Start with one tiny action that proves who you want to become.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Heatmap />
          
          {today?.identityEvidence && today.identityEvidence.length > 0 && (
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-medium">Identity Evidence</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-3">
                {today.identityEvidence.map((ev) => (
                  <div key={ev.identityId} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground truncate mr-2">{ev.identityName}</span>
                    <span className="font-mono text-primary">+{ev.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {today?.recentJournal && (
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-medium">Recent Journal</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm text-muted-foreground italic line-clamp-3">"{today.recentJournal.content}"</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
