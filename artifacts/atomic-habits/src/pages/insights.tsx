import { useGetDashboardInsights } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, BarChart, Trophy, AlertTriangle, Fingerprint, Hash } from "lucide-react";

export default function Insights() {
  const { data: insights, isLoading } = useGetDashboardInsights();

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!insights) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-muted-foreground text-sm mt-1">Deterministic analytics based on your logs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">7-Day Completion</CardTitle>
            <LineChart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">
              {(insights.last7Days * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Rolling average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">30-Day Completion</CardTitle>
            <BarChart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">
              {(insights.last30Days * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Monthly trend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Strongest Habit</CardTitle>
            <Trophy className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {insights.bestHabit?.name || "—"}
            </div>
            {insights.bestHabit && (
              <p className="text-xs text-muted-foreground mt-1">
                {insights.bestHabit.streak} day streak • {(insights.bestHabit.rate! * 100).toFixed(0)}% completion
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {insights.weakestHabit?.name || "—"}
            </div>
            {insights.weakestHabit && (
              <p className="text-xs text-muted-foreground mt-1">
                Lowest completion rate ({(insights.weakestHabit.rate! * 100).toFixed(0)}%)
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dominant Identity</CardTitle>
            <Fingerprint className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {insights.strongestIdentity?.name || "—"}
            </div>
            {insights.strongestIdentity && (
              <p className="text-sm text-muted-foreground mt-1">
                {insights.strongestIdentity.evidenceCount} pieces of evidence collected
              </p>
            )}
          </CardContent>
        </Card>

        {insights.topJournalTags && insights.topJournalTags.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" /> Top Journal Themes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mt-2">
                {insights.topJournalTags.map(tag => (
                  <div key={tag.tag} className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-1.5 rounded-full text-sm">
                    <span className="font-medium">{tag.tag}</span>
                    <span className="text-muted-foreground text-xs">{tag.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
