import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { promptTemplateSchema, type PromptTemplateFormValues } from "@/lib/langchain-schemas";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  promptTemplate?: any; // Pass existing prompt template for editing
}

export function PromptModal({ isOpen, onClose, promptTemplate }: PromptModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!promptTemplate;
  const [extractedVariables, setExtractedVariables] = useState<string[]>([]);
  
  // Create form
  const form = useForm<PromptTemplateFormValues>({
    resolver: zodResolver(promptTemplateSchema),
    defaultValues: {
      name: promptTemplate?.name || "",
      description: promptTemplate?.description || "",
      template: promptTemplate?.template || "",
      templateType: promptTemplate?.templateType || "string",
      variables: promptTemplate?.variables || [],
    },
  });

  // Watch the template to extract variables
  const template = form.watch("template");
  
  // Extract variables from template
  useEffect(() => {
    if (template) {
      // Find all occurrences of {variable} in the template
      const matches = template.match(/\{([^}]+)\}/g) || [];
      // Extract variable names without braces
      const variables = matches.map(match => match.slice(1, -1));
      // Remove duplicates
      const uniqueVariables = Array.from(new Set(variables));
      setExtractedVariables(uniqueVariables);
      
      // Update form value
      form.setValue("variables", uniqueVariables);
    } else {
      setExtractedVariables([]);
      form.setValue("variables", []);
    }
  }, [template, form]);

  // Create or update prompt template mutation
  const mutation = useMutation({
    mutationFn: async (data: PromptTemplateFormValues) => {
      if (isEditing) {
        return await apiRequest(`/api/langchain/prompts/${promptTemplate.id}`, {
          method: 'PATCH',
          data,
        });
      } else {
        return await apiRequest('/api/langchain/prompts', {
          method: 'POST',
          data,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: `Prompt template ${isEditing ? 'updated' : 'created'} successfully`,
        description: `The prompt template "${form.getValues().name}" has been ${isEditing ? 'updated' : 'created'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/prompts'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: `Failed to ${isEditing ? 'update' : 'create'} prompt template`,
        description: error.message || `There was an error ${isEditing ? 'updating' : 'creating'} the prompt template.`,
        variant: "destructive",
      });
    },
  });

  // Form submission
  const onSubmit = (data: PromptTemplateFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Prompt Template</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the configuration for this prompt template.' 
              : 'Create a new prompt template for LangChain agents.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Prompt Template" {...field} />
                  </FormControl>
                  <FormDescription>
                    A unique name for this prompt template
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="This template is used for..." 
                      className="min-h-[80px]" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Brief description of the template's purpose
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="templateType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="string">String Template</SelectItem>
                      <SelectItem value="chat">Chat Template</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Type of prompt template
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Write your template here. Use {variable} syntax for variables." 
                      className="min-h-[150px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    The prompt template. Use {"{variable}"} syntax for variables.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {extractedVariables.length > 0 && (
              <div className="p-3 border rounded-lg">
                <h4 className="text-sm font-medium mb-2">Detected Variables:</h4>
                <div className="flex flex-wrap gap-2">
                  {extractedVariables.map((variable) => (
                    <div key={variable} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs">
                      {variable}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update' : 'Create'} Template
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}