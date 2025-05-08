import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/ui/sidebar";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, TicketCheck, ClipboardList, CirclePlus, MessageCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Define types based on our backend schema
type User = {
  id: number;
  username: string;
  role: string;
};

type Issue = {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  submitterId: number;
  assignedToId?: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
};

type IssueComment = {
  id: number;
  issueId: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
};

type TodoItem = {
  id: number;
  title: string;
  description?: string;
  status: string;
  stage: number;
  priority: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  linkedIssueId?: number;
};

// Issue form
function IssueForm({ onSubmit, isSubmitting }: { onSubmit: (data: any) => void, isSubmitting: boolean }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("bug");
  const [priority, setPriority] = useState("medium");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      type,
      priority,
      status: "open"
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
        <Input 
          id="title" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          required 
          placeholder="Issue title"
        />
      </div>
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
        <Textarea 
          id="description" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          required 
          placeholder="Describe the issue or feedback"
          rows={4}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="type" className="block text-sm font-medium mb-1">Type</label>
          <select 
            id="type" 
            value={type} 
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="bug">Bug</option>
            <option value="feature">Feature Request</option>
            <option value="enhancement">Enhancement</option>
            <option value="question">Question</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="priority" className="block text-sm font-medium mb-1">Priority</label>
          <select 
            id="priority" 
            value={priority} 
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Submit Issue
      </Button>
    </form>
  );
}

// Comment form
function CommentForm({ issueId, onSubmit, isSubmitting }: { issueId: number, onSubmit: (data: any) => void, isSubmitting: boolean }) {
  const [content, setContent] = useState("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      content,
      issueId
    });
    setContent("");
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="comment" className="block text-sm font-medium mb-1">Add Comment</label>
        <Textarea 
          id="comment" 
          value={content} 
          onChange={(e) => setContent(e.target.value)} 
          required 
          placeholder="Add your comment"
          rows={3}
        />
      </div>
      
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Post Comment
      </Button>
    </form>
  );
}

// Issue details component
function IssueDetails({ issue, onBack }: { issue: Issue, onBack: () => void }) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  
  // Fetch comments for this issue
  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: [`/api/issues/${issue.id}/comments`],
    queryFn: () => apiRequest(`/api/issues/${issue.id}/comments`),
  });
  
  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest('POST', `/api/issues/${issue.id}/comments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/issues/${issue.id}/comments`] });
      toast({
        title: "Comment added",
        description: "Your comment has been added to the issue."
      });
      setNewComment("");
    },
    onError: (error) => {
      toast({
        title: "Failed to add comment",
        description: "There was an error adding your comment. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Close issue mutation
  const closeIssueMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest('POST', `/api/issues/${issue.id}/close`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/issues'] });
      queryClient.invalidateQueries({ queryKey: [`/api/issues/${issue.id}`] });
      toast({
        title: "Issue closed",
        description: "The issue has been closed successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to close issue",
        description: "There was an error closing the issue. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const handleCloseIssue = () => {
    closeIssueMutation.mutate({ resolution: "Resolved by user" });
  };
  
  const handleSubmitComment = (data: any) => {
    createCommentMutation.mutate(data);
  };
  
  // Format the priority for display
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-500">Low</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };
  
  // Format the type for display
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'bug':
        return <Badge className="bg-destructive">Bug</Badge>;
      case 'feature':
        return <Badge className="bg-blue-500">Feature</Badge>;
      case 'enhancement':
        return <Badge className="bg-purple-500">Enhancement</Badge>;
      case 'question':
        return <Badge className="bg-orange-500">Question</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };
  
  // Format the status for display
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-500">Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };
  
  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4">
        ← Back to Issues
      </Button>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">{issue.title}</CardTitle>
              <CardDescription className="mt-1">
                <span className="text-muted-foreground">
                  Created on {format(new Date(issue.createdAt), 'MMM d, yyyy')}
                </span>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {getTypeBadge(issue.type)}
              {getPriorityBadge(issue.priority)}
              {getStatusBadge(issue.status)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none">
            <p className="whitespace-pre-line">{issue.description}</p>
          </div>
          
          {issue.status !== 'completed' && (
            <div className="mt-6">
              <Button 
                onClick={handleCloseIssue} 
                disabled={closeIssueMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {closeIssueMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Closing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Close Issue
                  </>
                )}
              </Button>
            </div>
          )}
          
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Comments</h3>
            
            {isLoadingComments ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment: IssueComment) => (
                  <div key={comment.id} className="bg-card/50 p-4 rounded-md">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium">User #{comment.userId}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
                        {comment.isEdited && <span className="ml-2 italic">(Edited)</span>}
                      </div>
                    </div>
                    <p className="whitespace-pre-line">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center p-4 border border-dashed rounded-md">
                No comments yet.
              </p>
            )}
            
            <div className="mt-6">
              <CommentForm 
                issueId={issue.id} 
                onSubmit={handleSubmitComment} 
                isSubmitting={createCommentMutation.isPending} 
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main component for list of issues
function IssuesList() {
  const { toast } = useToast();
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  
  // Fetch issues
  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['/api/issues'],
    queryFn: async () => {
      const response = await apiRequest('/api/issues');
      console.log('Issues response:', response);
      return response;
    },
  });
  
  // Create issue mutation
  const createIssueMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest('POST', '/api/issues', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/issues'] });
      toast({
        title: "Issue created",
        description: "Your issue has been created successfully."
      });
      setShowIssueForm(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create issue",
        description: "There was an error creating your issue. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Filter issues based on current filter
  const filteredIssues = issues.filter((issue: Issue) => {
    if (filter === "all") return true;
    if (filter === "open") return issue.status === "open";
    if (filter === "in_progress") return issue.status === "in_progress";
    if (filter === "completed") return issue.status === "completed";
    return true;
  });
  
  const handleCreateIssue = (data: any) => {
    createIssueMutation.mutate(data);
  };
  
  // If viewing issue details
  if (selectedIssue) {
    return <IssueDetails issue={selectedIssue} onBack={() => setSelectedIssue(null)} />;
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Issues & Feedback</h1>
        <Button onClick={() => setShowIssueForm(!showIssueForm)}>
          {showIssueForm ? "Cancel" : (
            <>
              <CirclePlus className="mr-2 h-4 w-4" />
              New Issue
            </>
          )}
        </Button>
      </div>
      
      {showIssueForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Issue</CardTitle>
            <CardDescription>
              Submit a bug report, feature request, or feedback about the application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IssueForm
              onSubmit={handleCreateIssue}
              isSubmitting={createIssueMutation.isPending}
            />
          </CardContent>
        </Card>
      )}
      
      <div className="flex items-center space-x-4 mb-4">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <div className="flex space-x-2">
          <Badge 
            className={`cursor-pointer ${filter === "all" ? "bg-primary" : "bg-secondary hover:bg-secondary/80"}`}
            onClick={() => setFilter("all")}
          >
            All
          </Badge>
          <Badge 
            className={`cursor-pointer ${filter === "open" ? "bg-primary" : "bg-secondary hover:bg-secondary/80"}`}
            onClick={() => setFilter("open")}
          >
            Open
          </Badge>
          <Badge 
            className={`cursor-pointer ${filter === "in_progress" ? "bg-primary" : "bg-secondary hover:bg-secondary/80"}`}
            onClick={() => setFilter("in_progress")}
          >
            In Progress
          </Badge>
          <Badge 
            className={`cursor-pointer ${filter === "completed" ? "bg-primary" : "bg-secondary hover:bg-secondary/80"}`}
            onClick={() => setFilter("completed")}
          >
            Completed
          </Badge>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredIssues.length > 0 ? (
        <div className="space-y-4">
          {filteredIssues.map((issue: Issue) => (
            <Card 
              key={issue.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedIssue(issue)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle>{issue.title}</CardTitle>
                  <div className="flex items-center space-x-2">
                    {issue.status === "open" && (
                      <Badge className="bg-blue-500">Open</Badge>
                    )}
                    {issue.status === "in_progress" && (
                      <Badge className="bg-yellow-500">In Progress</Badge>
                    )}
                    {issue.status === "completed" && (
                      <Badge className="bg-green-500">Completed</Badge>
                    )}
                    {issue.priority === "high" && (
                      <Badge className="bg-red-500">High Priority</Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="flex items-center mt-1">
                  <span>{format(new Date(issue.createdAt), 'MMM d, yyyy')}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="line-clamp-2 text-muted-foreground">
                  {issue.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border border-dashed rounded-lg">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-medium text-lg mb-2">No issues found</h3>
          <p className="text-muted-foreground">
            {filter !== "all" ? 
              `No issues with status "${filter}" found. Try changing the filter or create a new issue.` :
              "There are no issues yet. Create the first one by clicking the 'New Issue' button."}
          </p>
        </div>
      )}
    </div>
  );
}

// Todo items list
function TodoList() {
  const { toast } = useToast();
  
  // Fetch todos
  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['/api/todo-items'],
    queryFn: async () => {
      const response = await apiRequest('/api/todo-items');
      console.log('Todo items response:', response);
      return response;
    },
  });
  
  // Complete todo mutation
  const completeTodoMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/todo-items/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todo-items'] });
      toast({
        title: "Task completed",
        description: "The task has been marked as completed."
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to complete task",
        description: "There was an error completing the task. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Group todos by stage
  const todosByStage: Record<number, TodoItem[]> = {};
  
  if (!isLoading && todos.length > 0) {
    todos.forEach((todo: TodoItem) => {
      if (!todosByStage[todo.stage]) {
        todosByStage[todo.stage] = [];
      }
      todosByStage[todo.stage].push(todo);
    });
  }
  
  const handleCompleteTodo = (id: number) => {
    completeTodoMutation.mutate(id);
  };
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-blue-500';
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Development Roadmap</h1>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : Object.keys(todosByStage).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(todosByStage)
            .sort(([stageA], [stageB]) => parseInt(stageA) - parseInt(stageB))
            .map(([stage, stageTodos]) => (
              <div key={stage} className="space-y-4">
                <h2 className="text-xl font-bold border-b pb-2">
                  Stage {stage}
                </h2>
                <div className="space-y-4">
                  {stageTodos.map((todo) => (
                    <Card key={todo.id} className="overflow-hidden">
                      <div className={`h-1 ${getPriorityColor(todo.priority)}`} />
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className={todo.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                            {todo.title}
                          </CardTitle>
                          <div className="flex items-center space-x-2">
                            {todo.status === 'pending' && (
                              <Badge className="bg-blue-500">Pending</Badge>
                            )}
                            {todo.status === 'in_progress' && (
                              <Badge className="bg-yellow-500">In Progress</Badge>
                            )}
                            {todo.status === 'completed' && (
                              <Badge className="bg-green-500">Completed</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {todo.description && (
                        <CardContent className="pb-4">
                          <p className="text-muted-foreground">{todo.description}</p>
                        </CardContent>
                      )}
                      {todo.status !== 'completed' && (
                        <CardFooter>
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => handleCompleteTodo(todo.id)}
                            disabled={completeTodoMutation.isPending}
                          >
                            {completeTodoMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Mark Complete
                          </Button>
                        </CardFooter>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center p-8 border border-dashed rounded-lg">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-medium text-lg mb-2">No tasks found</h3>
          <p className="text-muted-foreground">
            The development roadmap appears to be empty.
          </p>
        </div>
      )}
    </div>
  );
}

// Main feedback page content
function FeedbackContent() {
  return (
    <Tabs defaultValue="issues" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="issues">
          <MessageSquare className="w-4 h-4 mr-2" />
          Issues & Feedback
        </TabsTrigger>
        <TabsTrigger value="todos">
          <TicketCheck className="w-4 h-4 mr-2" />
          Development Roadmap
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="issues" className="mt-0">
        <IssuesList />
      </TabsContent>
      
      <TabsContent value="todos" className="mt-0">
        <TodoList />
      </TabsContent>
    </Tabs>
  );
}

// Main page component
export default function FeedbackPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  return (
    <div className={`min-h-screen bg-background flex flex-col ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Header onToggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        
        <main className="flex-1 app-content p-4 overflow-y-auto">
          <FeedbackContent />
        </main>
      </div>
    </div>
  );
}