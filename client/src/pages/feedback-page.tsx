import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  PlusCircle,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Send,
  Sparkles,
  User,
  Tag
} from "lucide-react";
import { format, compareDesc } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// Define types for issues and feedback
type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix';
type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
type IssueType = 'bug' | 'feature' | 'improvement' | 'question';

interface Issue {
  id: number;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  assignedTo: string | null;
  votes: number;
  comments: Comment[];
  tags: string[];
}

interface Comment {
  id: number;
  issueId: number;
  content: string;
  createdAt: Date;
  createdBy: string;
}

// Mock data for issues
const mockIssues: Issue[] = [
  {
    id: 1,
    title: "Dashboard doesn't update in real-time",
    description: "The power metrics on the dashboard don't update automatically. I have to refresh the page to see new data.",
    status: "in_progress",
    priority: "high",
    type: "bug",
    createdAt: new Date(2025, 4, 2), // May 2, 2025
    updatedAt: new Date(2025, 4, 5), // May 5, 2025
    createdBy: "john.doe",
    assignedTo: "tech.support",
    votes: 8,
    comments: [
      {
        id: 1,
        issueId: 1,
        content: "I'm having the same issue. It seems to happen more frequently during peak hours.",
        createdAt: new Date(2025, 4, 3), // May 3, 2025
        createdBy: "sarah.smith",
      },
      {
        id: 2,
        issueId: 1,
        content: "We're working on this issue. It's related to the WebSocket connection dropping. Should be fixed in the next update.",
        createdAt: new Date(2025, 4, 5), // May 5, 2025
        createdBy: "tech.support",
      }
    ],
    tags: ["dashboard", "real-time", "websocket"]
  },
  {
    id: 2,
    title: "Add mobile app support",
    description: "It would be great to have a mobile app version of the dashboard for monitoring on the go.",
    status: "open",
    priority: "medium",
    type: "feature",
    createdAt: new Date(2025, 3, 15), // April 15, 2025
    updatedAt: new Date(2025, 3, 18), // April 18, 2025
    createdBy: "sarah.smith",
    assignedTo: null,
    votes: 15,
    comments: [
      {
        id: 3,
        issueId: 2,
        content: "This would be very useful for our technicians in the field.",
        createdAt: new Date(2025, 3, 16), // April 16, 2025
        createdBy: "john.doe",
      },
      {
        id: 4,
        issueId: 2,
        content: "We're considering this for Q3. Would you prefer iOS, Android, or both?",
        createdAt: new Date(2025, 3, 18), // April 18, 2025
        createdBy: "product.manager",
      }
    ],
    tags: ["mobile", "feature-request", "enhancement"]
  },
  {
    id: 3,
    title: "Forecasting accuracy improvement",
    description: "The power consumption forecasts are consistently off by 10-15%. Can we improve the algorithm?",
    status: "open",
    priority: "medium",
    type: "improvement",
    createdAt: new Date(2025, 4, 1), // May 1, 2025
    updatedAt: new Date(2025, 4, 1), // May 1, 2025
    createdBy: "david.jones",
    assignedTo: null,
    votes: 5,
    comments: [],
    tags: ["forecasting", "algorithm", "accuracy"]
  },
  {
    id: 4,
    title: "Error when exporting reports to CSV",
    description: "When I try to export reports to CSV, I get an error message saying 'Export failed'.",
    status: "resolved",
    priority: "high",
    type: "bug",
    createdAt: new Date(2025, 3, 28), // April 28, 2025
    updatedAt: new Date(2025, 4, 6), // May 6, 2025
    createdBy: "emily.wilson",
    assignedTo: "tech.support",
    votes: 3,
    comments: [
      {
        id: 5,
        issueId: 4,
        content: "Fixed in version 1.2.3. The issue was related to handling large datasets.",
        createdAt: new Date(2025, 4, 6), // May 6, 2025
        createdBy: "tech.support",
      }
    ],
    tags: ["reports", "export", "csv", "fixed"]
  },
  {
    id: 5,
    title: "Add equipment maintenance prediction",
    description: "It would be helpful to have predictive maintenance alerts based on equipment performance patterns.",
    status: "open",
    priority: "low",
    type: "feature",
    createdAt: new Date(2025, 3, 20), // April 20, 2025
    updatedAt: new Date(2025, 3, 20), // April 20, 2025
    createdBy: "john.doe",
    assignedTo: null,
    votes: 7,
    comments: [],
    tags: ["equipment", "predictive-maintenance", "feature-request"]
  },
  {
    id: 6,
    title: "How do I set up alert notifications?",
    description: "I'd like to receive SMS or email notifications when power usage exceeds certain thresholds. How can I set this up?",
    status: "resolved",
    priority: "low",
    type: "question",
    createdAt: new Date(2025, 4, 3), // May 3, 2025
    updatedAt: new Date(2025, 4, 4), // May 4, 2025
    createdBy: "sarah.smith",
    assignedTo: "customer.support",
    votes: 1,
    comments: [
      {
        id: 6,
        issueId: 6,
        content: "You can configure notifications in Settings > Alerts > Notification Preferences. You'll need to verify your email or phone number first.",
        createdAt: new Date(2025, 4, 4), // May 4, 2025
        createdBy: "customer.support",
      }
    ],
    tags: ["notifications", "alerts", "how-to"]
  },
  {
    id: 7,
    title: "Equipment page doesn't load on Safari",
    description: "The equipment monitoring page fails to load properly when using Safari on macOS. Works fine on Chrome and Firefox.",
    status: "in_progress",
    priority: "medium",
    type: "bug",
    createdAt: new Date(2025, 4, 5), // May 5, 2025
    updatedAt: new Date(2025, 4, 6), // May 6, 2025
    createdBy: "emily.wilson",
    assignedTo: "tech.support",
    votes: 4,
    comments: [
      {
        id: 7,
        issueId: 7,
        content: "I can reproduce this on Safari 16.4. Looking into it now.",
        createdAt: new Date(2025, 4, 6), // May 6, 2025
        createdBy: "tech.support",
      }
    ],
    tags: ["safari", "browser-compatibility", "equipment-page"]
  },
];

// Define the schema for feedback form
const feedbackSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100, "Title must be less than 100 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000, "Description must be less than 1000 characters"),
  type: z.enum(["bug", "feature", "improvement", "question"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  tags: z.string().optional(),
});

// Define the schema for comment form
const commentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(500, "Comment must be less than 500 characters"),
});

export default function FeedbackPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("issues");
  const [issues, setIssues] = useState<Issue[]>(mockIssues);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setFilterPriority] = useState<string>("all");
  const [sortType, setSortType] = useState<"newest" | "oldest" | "most_votes" | "priority">("newest");
  
  // Get the selected issue
  const selectedIssue = selectedIssueId 
    ? issues.find(issue => issue.id === selectedIssueId) 
    : null;
  
  // Initialize form for feedback submission
  const feedbackForm = useForm<z.infer<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "bug",
      priority: "medium",
      tags: "",
    },
  });
  
  // Initialize form for comment submission
  const commentForm = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      content: "",
    },
  });
  
  // Filter and sort issues
  const getFilteredIssues = () => {
    // Apply filters
    let filtered = issues.filter(issue => {
      const statusMatch = statusFilter === "all" || issue.status === statusFilter;
      const typeMatch = typeFilter === "all" || issue.type === typeFilter;
      const priorityMatch = priorityFilter === "all" || issue.priority === priorityFilter;
      return statusMatch && typeMatch && priorityMatch;
    });
    
    // Apply sorting
    switch (sortType) {
      case "newest":
        filtered = filtered.sort((a, b) => compareDesc(new Date(a.createdAt), new Date(b.createdAt)));
        break;
      case "oldest":
        filtered = filtered.sort((a, b) => compareDesc(new Date(b.createdAt), new Date(a.createdAt)));
        break;
      case "most_votes":
        filtered = filtered.sort((a, b) => b.votes - a.votes);
        break;
      case "priority":
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        filtered = filtered.sort((a, b) => 
          priorityOrder[a.priority as keyof typeof priorityOrder] - 
          priorityOrder[b.priority as keyof typeof priorityOrder]
        );
        break;
    }
    
    return filtered;
  };
  
  // Format date for display
  const formatDate = (date: Date) => {
    return format(date, "MMM d, yyyy");
  };
  
  // Get status badge
  const getStatusBadge = (status: IssueStatus) => {
    switch (status) {
      case "open":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Open</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">In Progress</Badge>;
      case "resolved":
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Resolved</Badge>;
      case "wont_fix":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Won't Fix</Badge>;
    }
  };
  
  // Get priority badge
  const getPriorityBadge = (priority: IssuePriority) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">High</Badge>;
      case "medium":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Medium</Badge>;
      case "low":
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Low</Badge>;
    }
  };
  
  // Get type icon
  const getTypeIcon = (type: IssueType) => {
    switch (type) {
      case "bug":
        return <Bug className="h-4 w-4 text-red-500" />;
      case "feature":
        return <Sparkles className="h-4 w-4 text-purple-500" />;
      case "improvement":
        return <Lightbulb className="h-4 w-4 text-amber-500" />;
      case "question":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
    }
  };
  
  // Get type badge
  const getTypeBadge = (type: IssueType) => {
    switch (type) {
      case "bug":
        return (
          <div className="flex items-center gap-1">
            <Bug className="h-3.5 w-3.5 text-red-500" />
            <span>Bug</span>
          </div>
        );
      case "feature":
        return (
          <div className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span>Feature</span>
          </div>
        );
      case "improvement":
        return (
          <div className="flex items-center gap-1">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span>Improvement</span>
          </div>
        );
      case "question":
        return (
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
            <span>Question</span>
          </div>
        );
    }
  };
  
  // Submit new feedback
  const handleSubmitFeedback = (data: z.infer<typeof feedbackSchema>) => {
    // Create new issue
    const newIssue: Issue = {
      id: Math.max(...issues.map(issue => issue.id), 0) + 1,
      title: data.title,
      description: data.description,
      status: "open",
      priority: data.priority as IssuePriority,
      type: data.type as IssueType,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user?.username || "anonymous",
      assignedTo: null,
      votes: 0,
      comments: [],
      tags: data.tags ? data.tags.split(",").map(tag => tag.trim()) : [],
    };
    
    // Add new issue to the list
    setIssues([newIssue, ...issues]);
    
    // Show success message
    toast({
      title: "Feedback submitted",
      description: "Thank you for your feedback. We'll review it shortly.",
    });
    
    // Reset the form
    feedbackForm.reset();
    
    // Switch to issues tab and select the new issue
    setActiveTab("issues");
    setSelectedIssueId(newIssue.id);
  };
  
  // Submit new comment
  const handleSubmitComment = (data: z.infer<typeof commentSchema>) => {
    if (!selectedIssueId) return;
    
    // Create new comment
    const newComment: Comment = {
      id: Math.max(...issues.flatMap(issue => issue.comments.map(comment => comment.id)), 0) + 1,
      issueId: selectedIssueId,
      content: data.content,
      createdAt: new Date(),
      createdBy: user?.username || "anonymous",
    };
    
    // Add comment to the issue
    setIssues(issues.map(issue => 
      issue.id === selectedIssueId 
        ? { 
            ...issue, 
            comments: [...issue.comments, newComment],
            updatedAt: new Date(),
          } 
        : issue
    ));
    
    // Reset the comment form
    commentForm.reset();
  };
  
  // Vote for an issue
  const handleVote = (issueId: number) => {
    setIssues(issues.map(issue => 
      issue.id === issueId 
        ? { ...issue, votes: issue.votes + 1 } 
        : issue
    ));
  };
  
  // Calculate issue statistics
  const getIssueStats = () => {
    return {
      total: issues.length,
      open: issues.filter(issue => issue.status === "open").length,
      inProgress: issues.filter(issue => issue.status === "in_progress").length,
      resolved: issues.filter(issue => issue.status === "resolved").length,
      bugs: issues.filter(issue => issue.type === "bug").length,
      features: issues.filter(issue => issue.type === "feature").length,
      improvements: issues.filter(issue => issue.type === "improvement").length,
      questions: issues.filter(issue => issue.type === "question").length,
    };
  };
  
  const stats = getIssueStats();
  
  return (
    <Layout title="Feedback & Issues" description="Report issues and submit feedback for the system">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-2 w-full md:w-fit">
          <TabsTrigger value="issues">
            <Bug className="h-4 w-4 mr-2" />
            Issues & Feedback
          </TabsTrigger>
          <TabsTrigger value="new">
            <PlusCircle className="h-4 w-4 mr-2" />
            Submit New
          </TabsTrigger>
        </TabsList>
        
        {/* Issue Tracking Tab */}
        <TabsContent value="issues" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="mt-1 flex justify-between items-center text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>Open: {stats.open}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      <span>In Progress: {stats.inProgress}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span>Resolved: {stats.resolved}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span>Bugs: {stats.bugs}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">By Issue Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1">
                        <Bug className="h-3 w-3 text-red-500" />
                        Bugs
                      </span>
                      <span>{stats.bugs}</span>
                    </div>
                    <Progress value={(stats.bugs / stats.total) * 100} className="h-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-purple-500" />
                        Features
                      </span>
                      <span>{stats.features}</span>
                    </div>
                    <Progress value={(stats.features / stats.total) * 100} className="h-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1">
                        <Lightbulb className="h-3 w-3 text-amber-500" />
                        Improvements
                      </span>
                      <span>{stats.improvements}</span>
                    </div>
                    <Progress value={(stats.improvements / stats.total) * 100} className="h-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 text-blue-500" />
                        Questions
                      </span>
                      <span>{stats.questions}</span>
                    </div>
                    <Progress value={(stats.questions / stats.total) * 100} className="h-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recently Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {issues
                    .filter(issue => issue.status === "resolved")
                    .sort((a, b) => compareDesc(new Date(a.updatedAt), new Date(b.updatedAt)))
                    .slice(0, 3)
                    .map(issue => (
                      <div 
                        key={issue.id}
                        className="p-2 border rounded flex items-start gap-2 text-sm cursor-pointer hover:bg-accent"
                        onClick={() => setSelectedIssueId(issue.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <div>
                          <div>{issue.title}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <span>{formatDate(issue.updatedAt)}</span>
                            <span className="flex items-center gap-1">
                              {getTypeIcon(issue.type)}
                              <span>{issue.type}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  
                  {issues.filter(issue => issue.status === "resolved").length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-4">
                      No resolved issues yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bug">Bugs</SelectItem>
                  <SelectItem value="feature">Features</SelectItem>
                  <SelectItem value="improvement">Improvements</SelectItem>
                  <SelectItem value="question">Questions</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={priorityFilter} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Select value={sortType} onValueChange={(value) => setSortType(value as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="most_votes">Most Votes</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Issues List */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Issues</CardTitle>
                <CardDescription>
                  {getFilteredIssues().length} issues found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getFilteredIssues().map(issue => (
                    <div 
                      key={issue.id}
                      className={`p-3 rounded-lg border cursor-pointer ${
                        selectedIssueId === issue.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => setSelectedIssueId(issue.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {getTypeIcon(issue.type)}
                            <span>{issue.title}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                            <span>{formatDate(issue.createdAt)}</span>
                            <span>by {issue.createdBy}</span>
                          </div>
                        </div>
                        {getStatusBadge(issue.status)}
                      </div>
                      
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVote(issue.id);
                            }}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <span className="text-sm">{issue.votes}</span>
                        </div>
                        {getPriorityBadge(issue.priority)}
                      </div>
                      
                      {issue.comments.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{issue.comments.length} comment{issue.comments.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {getFilteredIssues().length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      No issues match the selected filters
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Issue Details */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedIssue ? (
                    <div className="flex items-center gap-2">
                      {getTypeIcon(selectedIssue.type)}
                      <span>{selectedIssue.title}</span>
                    </div>
                  ) : 'Issue Details'}
                </CardTitle>
                <CardDescription>
                  {selectedIssue ? (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span>Reported by {selectedIssue.createdBy} on {formatDate(selectedIssue.createdAt)}</span>
                      {getStatusBadge(selectedIssue.status)}
                      {getPriorityBadge(selectedIssue.priority)}
                    </div>
                  ) : 'Select an issue to view details'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedIssue ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg bg-muted/50">
                        <p>{selectedIssue.description}</p>
                      </div>
                      
                      {selectedIssue.tags.length > 0 && (
                        <div className="flex items-center flex-wrap gap-2">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                          {selectedIssue.tags.map((tag, index) => (
                            <Badge key={index} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleVote(selectedIssue.id)}
                            className="flex items-center gap-1 h-8"
                          >
                            <ChevronUp className="h-4 w-4" />
                            Upvote ({selectedIssue.votes})
                          </Button>
                        </div>
                        
                        <div>
                          {selectedIssue.assignedTo ? (
                            <div className="flex items-center gap-2 text-sm">
                              <span>Assigned to:</span>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback>{selectedIssue.assignedTo.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span>{selectedIssue.assignedTo}</span>
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline">Unassigned</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <h3 className="font-medium">Comments ({selectedIssue.comments.length})</h3>
                      
                      <div className="space-y-4">
                        {selectedIssue.comments.map(comment => (
                          <div key={comment.id} className="flex gap-4">
                            <Avatar>
                              <AvatarFallback>{comment.createdBy.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{comment.createdBy}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(comment.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                        
                        {selectedIssue.comments.length === 0 && (
                          <div className="text-center py-4 text-muted-foreground">
                            No comments yet
                          </div>
                        )}
                        
                        <Form {...commentForm}>
                          <form 
                            onSubmit={commentForm.handleSubmit(handleSubmitComment)} 
                            className="space-y-4"
                          >
                            <FormField
                              control={commentForm.control}
                              name="content"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Add Comment</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="Type your comment here..."
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <Button 
                              type="submit" 
                              className="gap-2"
                              disabled={!commentForm.formState.isValid}
                            >
                              <Send className="h-4 w-4" />
                              Post Comment
                            </Button>
                          </form>
                        </Form>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <p>Select an issue from the list to view details</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Or submit a new issue using the "Submit New" tab
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Submit New Issue Tab */}
        <TabsContent value="new" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit New Feedback</CardTitle>
              <CardDescription>
                Report an issue or suggest an improvement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...feedbackForm}>
                <form 
                  onSubmit={feedbackForm.handleSubmit(handleSubmitFeedback)} 
                  className="space-y-6"
                >
                  <FormField
                    control={feedbackForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Brief summary of the issue or suggestion"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          A clear, concise title helps others understand your feedback
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={feedbackForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="bug">
                                <div className="flex items-center gap-2">
                                  <Bug className="h-4 w-4 text-red-500" />
                                  <span>Bug Report</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="feature">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-purple-500" />
                                  <span>Feature Request</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="improvement">
                                <div className="flex items-center gap-2">
                                  <Lightbulb className="h-4 w-4 text-amber-500" />
                                  <span>Improvement</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="question">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-blue-500" />
                                  <span>Question</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={feedbackForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={feedbackForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Provide details about the issue or suggestion"
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Include steps to reproduce if reporting a bug, or detailed explanation if suggesting a feature
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={feedbackForm.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="dashboard, export, mobile, etc. (comma separated)"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional: Add tags to help categorize your feedback
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="gap-2"
                    disabled={!feedbackForm.formState.isValid || feedbackForm.formState.isSubmitting}
                  >
                    {feedbackForm.formState.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    Submit Feedback
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Before Submitting</CardTitle>
              <CardDescription>
                Tips for effective feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Bug className="h-5 w-5 text-red-500" />
                    <h3 className="font-medium">Reporting Bugs</h3>
                  </div>
                  <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
                    <li>Include steps to reproduce the issue</li>
                    <li>Describe what happened vs. what you expected</li>
                    <li>Note which page/feature the bug occurred in</li>
                    <li>Mention your browser and device if relevant</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="font-medium">Feature Requests</h3>
                  </div>
                  <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
                    <li>Clearly explain the problem you're trying to solve</li>
                    <li>Describe how the feature would work</li>
                    <li>Explain the benefit to users</li>
                    <li>Include mockups or examples if possible</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-500" />
                    <h3 className="font-medium">General Tips</h3>
                  </div>
                  <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
                    <li>Check if your issue has already been reported</li>
                    <li>Be specific and concise</li>
                    <li>One issue per submission</li>
                    <li>Use appropriate tags to help categorize</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}