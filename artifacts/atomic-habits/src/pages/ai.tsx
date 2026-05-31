import { useState } from "react";
import { 
  useGetAiStatus, 
  useAiChat, 
  useConfirmAiAction
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, Check, X, AlertCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  proposedAction?: any;
}

export default function AiCoach() {
  const { data: status } = useGetAiStatus();
  const chatMutation = useAiChat();
  const confirmMutation = useConfirmAiAction();

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello. I'm your habit coach. What system are we building or debugging today?" }
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);

  const contextChips = ["Last 7 days", "Missed habits", "Identities"];
  const suggestedPrompts = [
    "Why am I struggling with my morning routine?",
    "Help me design a habit stack for reading.",
    "Review my consistency over the last week."
  ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    chatMutation.mutate({
      data: {
        message: text,
        conversationId: conversationId,
        contextChips: []
      }
    }, {
      onSuccess: (res) => {
        setConversationId(res.conversationId);
        const asstMsg: Message = { 
          role: "assistant", 
          content: res.message,
          proposedAction: res.proposedAction 
        };
        setMessages(prev => [...prev, asstMsg]);
      }
    });
  };

  const handleConfirmAction = (actionType: string, payload: any, confirmed: boolean) => {
    confirmMutation.mutate({
      data: {
        proposedActionType: actionType,
        payload,
        confirmed
      }
    }, {
      onSuccess: () => {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: confirmed ? "Action applied." : "Action discarded."
        }]);
      }
    });
  };

  if (status?.available === false) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive opacity-50" />
        <h2 className="text-xl font-medium">AI Coach Unavailable</h2>
        <p className="text-muted-foreground max-w-md">
          {status.message || "Ollama is not reachable right now. Check your OLLAMA_BASE_URL, confirm the model is installed, and try again."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Coach</h1>
          <p className="text-muted-foreground text-sm">Powered by local AI. Your data stays here.</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted/50 border border-border/50'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  
                  {msg.proposedAction && (
                    <div className="mt-4 p-3 bg-background rounded border border-border">
                      <p className="text-xs font-medium uppercase tracking-wider mb-2 text-muted-foreground">Proposed Action: {msg.proposedAction.type}</p>
                      <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto mb-3">
                        {JSON.stringify(msg.proposedAction.payload, null, 2)}
                      </pre>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleConfirmAction(msg.proposedAction.type, msg.proposedAction.payload, true)} className="flex-1">
                          <Check className="w-3 h-3 mr-1" /> Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleConfirmAction(msg.proposedAction.type, msg.proposedAction.payload, false)} className="flex-1">
                          <X className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted/50 border border-border/50 rounded-lg p-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-background">
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestedPrompts.map(p => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  className="text-xs px-3 py-1.5 bg-muted/50 border border-border rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your habits..."
              className="flex-1 bg-muted/20"
              disabled={chatMutation.isPending}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || chatMutation.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
