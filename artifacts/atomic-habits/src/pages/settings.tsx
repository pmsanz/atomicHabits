import { useAuth } from "@/lib/auth-context";
import { 
  useExportHabitsCsv, 
  useExportJournalCsv, 
  useExportAllCsv 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, User as UserIcon } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  
  const exportHabits = useExportHabitsCsv();
  const exportJournal = useExportJournalCsv();
  const exportAll = useExportAllCsv();

  const handleDownload = async (mutation: any, filename: string) => {
    mutation.mutate(undefined, {
      onSuccess: (csvData: string) => {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and data.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserIcon className="w-5 h-5" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium">Name</div>
            <div className="text-muted-foreground text-sm">{user?.name}</div>
          </div>
          <div>
            <div className="text-sm font-medium">Email</div>
            <div className="text-muted-foreground text-sm">{user?.email}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="w-5 h-5" /> Data Export
          </CardTitle>
          <CardDescription>Download your data in CSV format. You own your data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              variant="outline" 
              onClick={() => handleDownload(exportHabits, 'habits_logs.csv')}
              disabled={exportHabits.isPending}
            >
              Export Habits
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleDownload(exportJournal, 'journal_entries.csv')}
              disabled={exportJournal.isPending}
            >
              Export Journal
            </Button>
            <Button 
              onClick={() => handleDownload(exportAll, 'atomic_habits_all_data.csv')}
              disabled={exportAll.isPending}
            >
              Export All Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
