import { useState } from "react";
import {
  useListJournalEntries,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
  getListJournalEntriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Edit2 } from "lucide-react";

export default function Journal() {
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useListJournalEntries();
  const createMutation = useCreateJournalEntry();

  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [search, setSearch] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);

  const updateMutation = useUpdateJournalEntry(editingEntryId ?? 0);
  const deleteMutation = useDeleteJournalEntry(deletingEntryId ?? 0);

  const prompts = [
    "What worked today?",
    "What blocked me?",
    "What tiny improvement will I make tomorrow?",
    "What identity did I reinforce today?",
    "Where did friction show up?",
  ];

  const handlePromptClick = (prompt: string) => {
    setContent(prev => prev ? `${prev}\n\n**${prompt}**\n` : `**${prompt}**\n`);
  };

  const handleEditEntry = (entry: { id: number; content: string; tags?: string[] | null }) => {
    setEditingEntryId(entry.id);
    setContent(entry.content);
    setTags((entry.tags ?? []).join(", "));
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setContent("");
    setTags("");
  };

  const handleSave = () => {
    if (!content.trim()) return;
    const tagArray = tags.split(",").map(t => t.trim()).filter(t => t.length > 0);

    if (editingEntryId) {
      updateMutation.mutate({ data: { content, tags: tagArray } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
          setEditingEntryId(null);
          setContent("");
          setTags("");
        },
      });
    } else {
      createMutation.mutate({
        data: { date: format(new Date(), "yyyy-MM-dd"), content, tags: tagArray },
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
          setContent("");
          setTags("");
        },
      });
    }
  };

  const handleDeleteEntry = (id: number) => {
    if (!confirm("Delete this journal entry?")) return;
    setDeletingEntryId(id);
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
        setDeletingEntryId(null);
      },
    });
  };

  const filteredEntries = entries?.filter(e =>
    e.content.toLowerCase().includes(search.toLowerCase()) ||
    e.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const isPending = editingEntryId ? updateMutation.isPending : createMutation.isPending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-2 flex flex-col h-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Journal</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {editingEntryId ? "Editing entry — make your changes below." : "Reflect on your systems and identity."}
            </p>
          </div>
          {editingEntryId && (
            <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-muted-foreground">
              Cancel edit
            </Button>
          )}
        </div>

        <Card className={`flex-1 flex flex-col ${editingEntryId ? "border-primary/50" : "border-primary/20"}`}>
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="p-4 border-b border-border/50 bg-muted/20">
              <div className="flex flex-wrap gap-2">
                {prompts.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
                    className="text-xs px-3 py-1.5 bg-background border border-border rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              className="flex-1 resize-none border-0 focus-visible:ring-0 rounded-none p-6 text-base leading-relaxed bg-transparent"
              placeholder="What are you noticing about your habits today?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between">
              <div className="flex-1 max-w-sm mr-4">
                <Input
                  placeholder="Tags (comma separated)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="h-8 text-sm bg-background"
                />
              </div>
              <Button onClick={handleSave} disabled={!content.trim() || isPending}>
                {isPending ? "Saving..." : editingEntryId ? "Save Changes" : "Save Entry"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col h-full space-y-4 border-l border-border pl-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : filteredEntries?.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center pt-8">No entries found.</div>
          ) : (
            filteredEntries?.map(entry => (
              <div
                key={entry.id}
                className={`text-sm space-y-2 pb-4 border-b border-border/50 last:border-0 group ${editingEntryId === entry.id ? "bg-primary/5 -mx-2 px-2 rounded" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-muted-foreground">
                    {format(new Date(entry.date), "MMM d, yyyy")}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditEntry(entry)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit entry"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="line-clamp-3 leading-relaxed text-foreground/90">
                  {entry.content}
                </div>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {entry.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
