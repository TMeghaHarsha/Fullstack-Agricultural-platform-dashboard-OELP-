import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Send, X } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgribotProps {
  API_URL: string;
  authHeaders: () => Record<string, string>;
}

export default function Agribot({ API_URL, authHeaders }: AgribotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usageInfo, setUsageInfo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open) {
      loadUsageInfo();
      // Add welcome message
      if (messages.length === 0) {
        setMessages([{
          role: "assistant",
          content: "Hello! I'm Agribot, your agricultural assistant. I can help you with farming questions, crop management, soil analysis, irrigation, and more. How can I assist you today?"
        }]);
      }
    }
  }, [open]);

  const loadUsageInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/agribot/`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsageInfo(data);
      }
    } catch (error) {
      console.error("Failed to load usage info:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/agribot/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json();

      // Backend now returns 200 with error messages, so check for error field
      if (res.ok) {
        // Check if there's an error in the response
        if (data.error) {
          if (data.error === "off_topic") {
            setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
          } else if (data.error === "limit_exceeded") {
            toast.error(data.detail || "Daily limit exceeded");
            setMessages((prev) => [...prev, { role: "assistant", content: data.detail || "You've reached your daily limit. Please try again tomorrow or upgrade to Enterprise for unlimited access." }]);
          } else if (data.error === "feature_not_available") {
            toast.error(data.detail || "AI Assistant not available");
            setMessages((prev) => [...prev, { role: "assistant", content: data.detail || "AI Assistant is only available with TopUp or Enterprise plans." }]);
          } else if (data.error === "quota_exceeded") {
            toast.error("AI service quota exceeded. Please contact support or check OpenAI billing.");
            setMessages((prev) => [...prev, { role: "assistant", content: data.response || "I'm currently unavailable due to service limitations. Please contact support." }]);
          } else if (data.error === "rate_limit") {
            toast.warning("Rate limit reached. Please wait a moment.");
            setMessages((prev) => [...prev, { role: "assistant", content: data.response || "I'm receiving too many requests. Please wait and try again." }]);
          } else {
            // Other errors - show the response message
            if (data.response) {
              setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
            } else {
              toast.error(data.detail || "Failed to get response");
              setMessages((prev) => [...prev, { role: "assistant", content: "I'm sorry, I encountered an error. Please try again later." }]);
            }
          }
        } else {
          // Success - no error
          setMessages((prev) => [...prev, { role: "assistant", content: data.response || "I'm sorry, I couldn't generate a response." }]);
          if (data.remaining !== undefined) {
            setUsageInfo((prev: any) => ({ ...prev, remaining: data.remaining }));
          }
        }
      } else {
        // HTTP error status
        if (data.error === "off_topic") {
          setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
        } else if (data.error === "limit_exceeded") {
          toast.error(data.detail || "Daily limit exceeded");
          setMessages((prev) => [...prev, { role: "assistant", content: data.detail || "You've reached your daily limit. Please try again tomorrow or upgrade to Enterprise for unlimited access." }]);
        } else if (data.error === "feature_not_available") {
          toast.error(data.detail || "AI Assistant not available");
          setMessages((prev) => [...prev, { role: "assistant", content: data.detail || "AI Assistant is only available with TopUp or Enterprise plans." }]);
        } else {
          toast.error(data.detail || "Failed to get response");
          setMessages((prev) => [...prev, { role: "assistant", content: "I'm sorry, I encountered an error. Please try again later." }]);
        }
      }
    } catch (error: any) {
      toast.error("Failed to send message");
      setMessages((prev) => [...prev, { role: "assistant", content: "I'm sorry, I encountered an error. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg z-50"
        size="lg"
      >
        <Bot className="h-6 w-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl h-[600px] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Agribot
              </DialogTitle>
              {usageInfo && !usageInfo.is_unlimited && usageInfo.remaining !== null && (
                <span className="text-sm text-muted-foreground">
                  {usageInfo.remaining} prompts remaining today
                </span>
              )}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Agribot is thinking...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ask about farming, crops, soil, irrigation..."
              disabled={loading}
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

