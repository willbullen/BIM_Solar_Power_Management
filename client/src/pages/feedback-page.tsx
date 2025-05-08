import { useState, useEffect, useMemo, useRef } from "react";
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
  const [errors, setErrors] = useState<{title?: string; description?: string}>({});
  
  // Track character count for description
  const descriptionCharsRemaining = 2000 - description.length;
  const isDescriptionTooLong = descriptionCharsRemaining < 0;
  
  const validateForm = () => {
    const newErrors: {title?: string; description?: string} = {};
    let isValid = true;
    
    if (!title.trim()) {
      newErrors.title = "Title is required";
      isValid = false;
    } else if (title.length < 5) {
      newErrors.title = "Title must be at least 5 characters";
      isValid = false;
    } else if (title.length > 100) {
      newErrors.title = "Title must be less than 100 characters";
      isValid = false;
    }
    
    if (!description.trim()) {
      newErrors.description = "Description is required";
      isValid = false;
    } else if (description.length < 10) {
      newErrors.description = "Description must be at least 10 characters";
      isValid = false;
    } else if (description.length > 2000) {
      newErrors.description = "Description must be less than 2000 characters";
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        title,
        description,
        type,
        priority,
        status: "open"
      });
    }
  };
  
  // Get the icon for the issue type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'feature':
        return <CirclePlus className="h-4 w-4 text-blue-500" />;
      case 'enhancement':
        return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-purple-500"><path d="m6 9 6 6 6-6"/></svg>;
      case 'question':
        return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-orange-500"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label htmlFor="title" className="text-sm font-medium">Title</label>
          <span className="text-xs text-muted-foreground">
            {title.length}/100 characters
          </span>
        </div>
        <Input 
          id="title" 
          value={title} 
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) {
              setErrors({...errors, title: undefined});
            }
          }}
          placeholder="Brief summary of the issue"
          className={errors.title ? "border-destructive" : ""}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-destructive">{errors.title}</p>
        )}
      </div>
      
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <span className={`text-xs ${isDescriptionTooLong ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {descriptionCharsRemaining} characters remaining
          </span>
        </div>
        <Textarea 
          id="description" 
          value={description} 
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) {
              setErrors({...errors, description: undefined});
            }
          }}
          placeholder="Please provide detailed information about the issue or feature request"
          rows={6}
          className={errors.description ? "border-destructive" : ""}
        />
        {errors.description && (
          <p className="mt-1 text-xs text-destructive">{errors.description}</p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label htmlFor="type" className="block text-sm font-medium mb-1.5">Issue Type</label>
          <div className="flex items-center space-x-2 mb-2">
            {getTypeIcon(type)}
            <span className="text-sm">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
          </div>
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
          <p className="mt-1 text-xs text-muted-foreground">
            Select the type that best describes your issue
          </p>
        </div>
        
        <div>
          <label htmlFor="priority" className="block text-sm font-medium mb-1.5">Priority</label>
          <div className="relative">
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
            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-md ${
              priority === 'high' ? 'bg-red-500' : 
              priority === 'medium' ? 'bg-yellow-500' : 
              'bg-green-500'
            }`}></div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {priority === 'high' ? 
              'High priority issues need immediate attention' : 
              priority === 'medium' ? 
                'Medium priority issues will be addressed soon' : 
                'Low priority issues will be addressed when possible'
            }
          </p>
        </div>
      </div>
      
      <div className="pt-2">
        <Button 
          type="submit" 
          disabled={isSubmitting || isDescriptionTooLong}
          className="w-full sm:w-auto bg-primary/90 hover:bg-primary transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CirclePlus className="mr-2 h-4 w-4" />
              Submit Issue
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// Comment form
function CommentForm({ issueId, onSubmit, isSubmitting }: { issueId: number, onSubmit: (data: any) => void, isSubmitting: boolean }) {
  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim() === "") return;
    
    onSubmit({
      content,
      issueId
    });
    setContent("");
    setIsFocused(false);
    textareaRef.current?.blur();
  };
  
  const handleCancel = () => {
    setContent("");
    setIsFocused(false);
    textareaRef.current?.blur();
  };
  
  const remainingChars = 1000 - content.length;
  const isExceedingLimit = remainingChars < 0;
  
  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <form onSubmit={handleSubmit}>
        <div>
          <div className="p-1 bg-card/50">
            <Textarea 
              ref={textareaRef}
              id="comment" 
              placeholder="Add your comment here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setIsFocused(true)}
              rows={isFocused ? 5 : 3}
              className="w-full resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            />
          </div>
          
          <div className={`flex justify-between items-center p-2 border-t border-border/30 transition-all duration-200 ${isFocused || content ? 'opacity-100' : 'opacity-0'}`}>
            <div className="text-xs text-muted-foreground">
              <span className={isExceedingLimit ? 'text-destructive font-semibold' : ''}>
                {remainingChars} characters remaining
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={handleCancel}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting || content.trim() === "" || isExceedingLimit}
                size="sm"
                className="h-8 text-xs bg-primary/90 hover:bg-primary transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 h-3 w-3">
                      <path d="m3 10 10 10L21 4"/>
                    </svg>
                    Submit Comment
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
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
      onBack(); // Return to the issues list after closing
    },
    onError: (error) => {
      toast({
        title: "Failed to close issue",
        description: "There was an error closing the issue. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest('PATCH', `/api/issues/${issue.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/issues'] });
      queryClient.invalidateQueries({ queryKey: [`/api/issues/${issue.id}`] });
      toast({
        title: "Status updated",
        description: "The issue status has been updated successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: "There was an error updating the status. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const handleUpdateStatus = (status: string) => {
    updateStatusMutation.mutate({ status });
  };
  
  const handleCloseIssue = () => {
    closeIssueMutation.mutate({ resolution: "Resolved by user" });
  };
  
  const handleSubmitComment = (data: any) => {
    createCommentMutation.mutate(data);
  };
  
  // Get the icon for the issue type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'feature':
        return <CirclePlus className="h-5 w-5 text-blue-500" />;
      case 'enhancement':
        return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-purple-500"><path d="m6 9 6 6 6-6"/></svg>;
      case 'question':
        return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-orange-500"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
      default:
        return <MessageSquare className="h-5 w-5" />;
    }
  };
  
  // Format the priority for display
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500 hover:bg-red-600">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-500 hover:bg-green-600">Low</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };
  
  // Format the type for display
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'bug':
        return <Badge className="bg-destructive hover:bg-destructive/90">Bug</Badge>;
      case 'feature':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Feature</Badge>;
      case 'enhancement':
        return <Badge className="bg-purple-500 hover:bg-purple-600">Enhancement</Badge>;
      case 'question':
        return <Badge className="bg-orange-500 hover:bg-orange-600">Question</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };
  
  // Format the status for display
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };
  
  return (
    <div className="pb-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={onBack} className="mr-2">
          ← Back
        </Button>
        <h2 className="text-2xl font-bold">Issue Details</h2>
      </div>
      
      <Card className="border border-border/40 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {getTypeIcon(issue.type)}
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{issue.title}</CardTitle>
                <CardDescription className="mt-1 text-muted-foreground">
                  Issue #{issue.id} opened on {format(new Date(issue.createdAt), 'MMM d, yyyy')} by User #{issue.submitterId}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {getTypeBadge(issue.type)}
              {getPriorityBadge(issue.priority)}
              {getStatusBadge(issue.status)}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          {/* Issue description with styling */}
          <div className="prose prose-invert max-w-none mb-8 p-4 bg-card/40 rounded-md border border-border/30">
            <p className="whitespace-pre-line text-base">{issue.description}</p>
          </div>
          
          {/* Status control */}
          {issue.status !== 'completed' && (
            <div className="mb-8 p-4 bg-card/30 rounded-lg border border-border/30">
              <h3 className="text-base font-medium mb-3">Update Status</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant={issue.status === 'open' ? 'default' : 'outline'} 
                  onClick={() => handleUpdateStatus('open')}
                  disabled={updateStatusMutation.isPending || issue.status === 'open'}
                  className="text-xs"
                >
                  Open
                </Button>
                <Button 
                  size="sm" 
                  variant={issue.status === 'in_progress' ? 'default' : 'outline'}
                  onClick={() => handleUpdateStatus('in_progress')}
                  disabled={updateStatusMutation.isPending || issue.status === 'in_progress'}
                  className="text-xs"
                >
                  In Progress
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={handleCloseIssue}
                  disabled={closeIssueMutation.isPending}
                  className="ml-auto text-xs"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {closeIssueMutation.isPending ? "Closing..." : "Close Issue"}
                </Button>
              </div>
            </div>
          )}
          
          {/* Comments section */}
          <div className="mt-6">
            <div className="flex items-center mb-4">
              <MessageCircle className="mr-2 h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Comments</h3>
              <Badge variant="outline" className="ml-2 px-2 py-0 h-5">
                {comments.length}
              </Badge>
            </div>
            
            {isLoadingComments ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment: IssueComment) => (
                  <div key={comment.id} className="bg-card/30 p-4 rounded-md border border-border/30">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary mr-2">
                          {comment.userId.toString().charAt(0)}
                        </div>
                        <div className="font-medium">User #{comment.userId}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
                        {comment.isEdited && <span className="ml-2 italic">(Edited)</span>}
                      </div>
                    </div>
                    <div className="pl-10">
                      <p className="whitespace-pre-line">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed rounded-md bg-card/20">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No comments yet. Be the first to add a comment.</p>
              </div>
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
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  
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
  
  // Filter and search issues
  const filteredAndSortedIssues = useMemo(() => {
    // First, filter by status
    let result = issues.filter((issue: Issue) => {
      if (filter === "all") return true;
      return issue.status === filter;
    });
    
    // Then, filter by search term
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((issue: Issue) => 
        issue.title.toLowerCase().includes(term) || 
        issue.description.toLowerCase().includes(term)
      );
    }
    
    // Finally, sort the issues
    return result.sort((a: Issue, b: Issue) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "priority":
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority as keyof typeof priorityOrder] - 
                 priorityOrder[b.priority as keyof typeof priorityOrder];
        default:
          return 0;
      }
    });
  }, [issues, filter, searchTerm, sortBy]);
  
  const handleCreateIssue = (data: any) => {
    createIssueMutation.mutate(data);
  };
  
  // Count issues by status
  const issueCounts = useMemo(() => {
    const counts = {
      all: issues.length,
      open: 0,
      in_progress: 0,
      completed: 0
    };
    
    issues.forEach((issue: Issue) => {
      if (counts[issue.status as keyof typeof counts] !== undefined) {
        counts[issue.status as keyof typeof counts]++;
      }
    });
    
    return counts;
  }, [issues]);
  
  // Get the icon for the issue type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'feature':
        return <CirclePlus className="h-4 w-4 text-blue-500" />;
      case 'enhancement':
        return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-purple-500"><path d="m6 9 6 6 6-6"/></svg>;
      case 'question':
        return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-orange-500"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };
  
  // If viewing issue details
  if (selectedIssue) {
    return <IssueDetails issue={selectedIssue} onBack={() => setSelectedIssue(null)} />;
  }
  
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Issues & Feedback</h1>
        <Button 
          onClick={() => setShowIssueForm(!showIssueForm)}
          className="bg-primary/90 hover:bg-primary transition-colors"
          size="sm"
        >
          {showIssueForm ? "Cancel" : (
            <>
              <CirclePlus className="mr-2 h-4 w-4" />
              New Issue
            </>
          )}
        </Button>
      </div>
      
      {showIssueForm && (
        <Card className="mb-8 border border-border/50 shadow-md">
          <CardHeader className="bg-card/50 pb-2">
            <CardTitle>Create New Issue</CardTitle>
            <CardDescription>
              Submit a bug report, feature request, or feedback about the application.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <IssueForm
              onSubmit={handleCreateIssue}
              isSubmitting={createIssueMutation.isPending}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Search and Filter Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              className="pl-10"
              placeholder="Search issues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <select 
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">Priority (High to Low)</option>
            </select>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Button 
            variant={filter === "all" ? "default" : "outline"} 
            onClick={() => setFilter("all")}
            size="sm"
            className="text-xs h-8"
          >
            All
            <Badge variant="secondary" className="ml-2 bg-primary/20">
              {issueCounts.all}
            </Badge>
          </Button>
          <Button 
            variant={filter === "open" ? "default" : "outline"}
            onClick={() => setFilter("open")}
            size="sm"
            className="text-xs h-8"
          >
            Open
            <Badge variant="secondary" className="ml-2 bg-primary/20">
              {issueCounts.open}
            </Badge>
          </Button>
          <Button 
            variant={filter === "in_progress" ? "default" : "outline"}
            onClick={() => setFilter("in_progress")}
            size="sm"
            className="text-xs h-8"
          >
            In Progress
            <Badge variant="secondary" className="ml-2 bg-primary/20">
              {issueCounts.in_progress}
            </Badge>
          </Button>
          <Button 
            variant={filter === "completed" ? "default" : "outline"}
            onClick={() => setFilter("completed")}
            size="sm"
            className="text-xs h-8"
          >
            Completed
            <Badge variant="secondary" className="ml-2 bg-primary/20">
              {issueCounts.completed}
            </Badge>
          </Button>
        </div>
      </div>
      
      {/* Issues List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading issues...</p>
        </div>
      ) : filteredAndSortedIssues.length > 0 ? (
        <div className="space-y-3">
          {filteredAndSortedIssues.map((issue: Issue) => (
            <Card 
              key={issue.id} 
              className="overflow-hidden cursor-pointer hover:bg-card/80 transition-colors border border-border/50 shadow-sm"
              onClick={() => setSelectedIssue(issue)}
            >
              <div className={`h-1 ${issue.priority === 'high' ? 'bg-red-500' : issue.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-2">
                    <div className="mt-[2px]">
                      {getTypeIcon(issue.type)}
                    </div>
                    <CardTitle className="text-base font-semibold">{issue.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {issue.status === "open" && (
                      <Badge className="bg-blue-500 hover:bg-blue-600 text-[10px]">Open</Badge>
                    )}
                    {issue.status === "in_progress" && (
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-[10px]">In Progress</Badge>
                    )}
                    {issue.status === "completed" && (
                      <Badge className="bg-green-500 hover:bg-green-600 text-[10px]">Completed</Badge>
                    )}
                    {issue.priority === "high" && (
                      <Badge className="bg-red-500 hover:bg-red-600 text-[10px]">High Priority</Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="flex items-center mt-1 text-xs">
                  <span className="text-muted-foreground">#{issue.id} opened on {format(new Date(issue.createdAt), 'MMM d, yyyy')}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {issue.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed rounded-lg">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium text-lg mb-2">No issues found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {searchTerm ? 
              `No issues matching "${searchTerm}" found. Try a different search term or clear your search.` :
              filter !== "all" ? 
                `No issues with status "${filter}" found. Try changing the filter or create a new issue.` :
                "There are no issues yet. Create the first one by clicking the 'New Issue' button."}
          </p>
          {(searchTerm || filter !== "all") && (
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                setSearchTerm("");
                setFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
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