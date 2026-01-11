import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, CalendarIcon, Tag, FileText, 
  User, Users, Settings, Palette, Type, 
  Link as LinkIcon, CheckCircle2, AlertCircle,
  Info, Layout, AlignLeft, AlignCenter, AlignRight,
  ChevronDown, ChevronUp, MessageSquare, FileSpreadsheet
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { useUser } from '@clerk/nextjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface PropertiesPanelProps {
  selectedNode: any;
  onSave: (nodeId: string, data: any) => void;
  onClose: () => void;
  projectId?: string | null;
  projectOwnerId?: string | null;
  isPublished?: boolean;
  sheets?: any[];
}

interface User {
  clerk_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

export const PropertiesPanel = ({ selectedNode, onSave, onClose, projectId, projectOwnerId, isPublished, sheets = [] }: PropertiesPanelProps) => {
  const { user } = useUser();
  const [formData, setFormData] = useState<any>({
    label: '',
    state: 'None',
    backgroundColor: '',
    textColor: '',
    fontSize: 14,
    isBold: false,
    alignment: 'center',
    verticalAlignment: 'middle',
    wrapText: false,
    links: [],
    templates: [],
    guidelines: [],
    checklists: [],
    roles: [],
    responsibility: [],
    support: [],
    linkedSheetId: '',
    description: '',
    verificationComments: '',
    authorComments: '',
    reviewerComments: '',
    rolesDescription: '',
    responsibilitiesDescription: '',
    deadline: undefined as Date | undefined,
  });

  const [initialFormData, setInitialFormData] = useState<any>(null);
  const [showRolesManager, setShowRolesManager] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const isTextNode = selectedNode?.type === 'text';
  const isWorkProduct = selectedNode?.type === 'workProduct';
  const isActivity = selectedNode?.type === 'activity';
  const isDecision = selectedNode?.type === 'decision';
  const isProcess = selectedNode?.type === 'process';
  const isDocument = selectedNode?.type === 'document';

  // Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentAddField, setCurrentAddField] = useState('');
  const [newItemValue, setNewItemValue] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');

  // Multi-link state for Workproducts
  const [templateUrl, setTemplateUrl] = useState('');
  const [templateLabel, setTemplateLabel] = useState('');
  const [guidelinesUrl, setGuidelinesUrl] = useState('');
  const [guidelinesLabel, setGuidelinesLabel] = useState('');
  const [checklistUrl, setChecklistUrl] = useState('');
  const [checklistLabel, setChecklistLabel] = useState('');

  const openAddDialog = (field: string) => {
    setCurrentAddField(field);
    setNewItemValue('');
    setNewLinkLabel('');
    
    // Reset multi-link fields
    setTemplateUrl('');
    setTemplateLabel('');
    setGuidelinesUrl('');
    setGuidelinesLabel('');
    setChecklistUrl('');
    setChecklistLabel('');
    
    setIsAddDialogOpen(true);
  };

  const handleAddItem = () => {
    if (isWorkProduct && currentAddField === 'links') {
      const newLinks = [...(formData.links || [])];
      
      if (templateUrl) {
        newLinks.push({ url: templateUrl, label: templateLabel || `Template: ${templateUrl}` });
      }
      if (guidelinesUrl) {
        newLinks.push({ url: guidelinesUrl, label: guidelinesLabel || `Guideline: ${guidelinesUrl}` });
      }
      if (checklistUrl) {
        newLinks.push({ url: checklistUrl, label: checklistLabel || `Checklist: ${checklistUrl}` });
      }

      if (newLinks.length > (formData.links?.length || 0)) {
        setFormData((prev: any) => ({
          ...prev,
          links: newLinks
        }));
      }
      setIsAddDialogOpen(false);
      return;
    }

    if (newItemValue && currentAddField) {
      let itemToAdd: any = newItemValue;
      if (currentAddField === 'links') {
        itemToAdd = { url: newItemValue, label: newLinkLabel || newItemValue };
      }
      
      setFormData((prev: any) => ({
        ...prev,
        [currentAddField]: [...(prev[currentAddField] || []), itemToAdd]
      }));
      setIsAddDialogOpen(false);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;
      setLoadingUsers(true);
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          headers: {
            'X-Clerk-User-Id': user.id
          }
        });
        setAvailableUsers(response.data);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [user]);

  useEffect(() => {
    if (selectedNode) {
      const data = {
        label: selectedNode.data.label || '',
        state: selectedNode.data.state || 'None',
        backgroundColor: selectedNode.data.backgroundColor || '',
        textColor: selectedNode.data.textColor || '',
        fontSize: selectedNode.data.fontSize || 14,
        isBold: selectedNode.data.isBold || false,
        alignment: selectedNode.data.alignment || 'center',
        verticalAlignment: selectedNode.data.verticalAlignment || 'middle',
        wrapText: selectedNode.data.wrapText || false,
        links: selectedNode.data.links || [],
        templates: selectedNode.data.templates || [],
        guidelines: selectedNode.data.guidelines || [],
        checklists: selectedNode.data.checklists || [],
        roles: selectedNode.data.roles || [],
        responsibility: selectedNode.data.responsibility || [],
        support: selectedNode.data.support || [],
        linkedSheetId: selectedNode.data.linkedSheetId || '',
        description: selectedNode.data.description || '',
        verificationComments: selectedNode.data.verificationComments || '',
        authorComments: selectedNode.data.authorComments || '',
        reviewerComments: selectedNode.data.reviewerComments || '',
        rolesDescription: selectedNode.data.rolesDescription || '',
        responsibilitiesDescription: selectedNode.data.responsibilitiesDescription || '',
        deadline: selectedNode.data.deadline ? new Date(selectedNode.data.deadline) : undefined
      };
      setFormData(data);
      setInitialFormData(data);
    }
  }, [selectedNode]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };


  const handleArrayRemove = (field: string, index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: prev[field].filter((_: any, i: number) => i !== index)
    }));
  };

  const handleUserSelection = (field: string, userId: string) => {
      if (!userId) return;
      
      // For responsibility, we only want ONE user, not an array
      if (field === 'responsibility') {
          setFormData((prev: any) => ({
              ...prev,
              [field]: [userId] // Store ID, not name, for easier permission checks
          }));
      } else {
          // Store ID for support as well to enable full user details in NodeInfoDialog
          if (!formData[field].includes(userId)) {
              setFormData((prev: any) => ({
                  ...prev,
                  [field]: [...(prev[field] || []), userId]
              }));
          }
      }
  };

  const handleMemberSelectionForRoles = (userId: string) => {
    if (userId && !formData.roles?.includes(userId)) {
      setFormData((prev: any) => ({
        ...prev,
        roles: [...(prev.roles || []), userId]
      }));
    }
  };

  const handleRemoveRole = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      roles: prev.roles.filter((_: any, i: number) => i !== index)
    }));
  };

  const canUpdateState = () => {
    // Admin can always update
    // Responsible person can update
    // If no responsibility assigned, maybe anyone can update? Or just admin? 
    // Let's assume if no one assigned, anyone can update (Draft mode).
    
    // We need to check if the current user's ID matches the stored responsibility ID.
    // Note: In handleUserSelection above, I changed it to store ID for 'responsibility'.
    // But existing data might have names. We should handle both or migrate.
    // For this new feature, we assume IDs are stored.
    
    // Check if user is admin (we need role from context or user metadata)
    // We don't have the user's role in this component directly, but we can fetch it or pass it.
    // For now, let's rely on the responsibility check.
    
    if (!formData.responsibility || formData.responsibility.length === 0) return true;
    
    const responsibleId = formData.responsibility[0]; // Assuming single responsibility
    return user?.id === responsibleId; 
    // Note: We really should check for Admin role too. 
    // Since we don't have the role context here easily without adding it, 
    // I will add a simple check if we can get it, otherwise rely on responsibility.
  };

  const handleStateChange = (newState: string) => {
    // We need to check permissions here.
    const currentUser = availableUsers.find(u => u.clerk_id === user?.id);
    const isAdmin = currentUser?.role === 'admin';
    const isOwner = projectOwnerId === user?.id;
    
    const responsibleId = formData.responsibility?.[0];
    const isResponsible = responsibleId === user?.id;

    if (isAdmin || isOwner || isResponsible || !responsibleId) {
        handleChange('state', newState);
    }
  };

  const handleCommentChange = (field: string, value: string) => {
    const currentUser = availableUsers.find(u => u.clerk_id === user?.id);
    const isAdmin = currentUser?.role === 'admin';
    const isOwner = projectOwnerId === user?.id;
    
    const responsibleId = formData.responsibility?.[0];
    const isResponsible = responsibleId === user?.id;
    const isSupport = formData.support?.includes(user?.id);

    if (field === 'authorComments') {
        if (isAdmin || isOwner || isResponsible || isSupport) {
            handleChange(field, value);
        }
    } else if (field === 'verificationComments') {
        if (isAdmin || isResponsible || isSupport) {
            handleChange(field, value);
        }
    } else if (field === 'reviewerComments') {
        if (isAdmin || isOwner || isResponsible || isSupport) {
            handleChange(field, value);
        }
    } else {
        handleChange(field, value);
    }
  };

  const canEditAuthorComments = () => {
    const currentUser = availableUsers.find(u => u.clerk_id === user?.id);
    const isAdmin = currentUser?.role === 'admin';
    const isOwner = projectOwnerId === user?.id;
    const isResponsible = formData.responsibility?.[0] === user?.id;
    const isSupport = formData.support?.includes(user?.id);
    return isAdmin || isOwner || isResponsible || isSupport;
  };

  const canEditVerificationComments = () => {
    const currentUser = availableUsers.find(u => u.clerk_id === user?.id);
    const isAdmin = currentUser?.role === 'admin';
    const isResponsible = formData.responsibility?.[0] === user?.id;
    const isSupport = formData.support?.includes(user?.id);
    return isAdmin || isResponsible || isSupport;
  };

  const canEditReviewerComments = () => {
    const currentUser = availableUsers.find(u => u.clerk_id === user?.id);
    const isAdmin = currentUser?.role === 'admin';
    const isOwner = projectOwnerId === user?.id;
    const isResponsible = formData.responsibility?.[0] === user?.id;
    const isSupport = formData.support?.includes(user?.id);
    return isAdmin || isOwner || isResponsible || isSupport;
  };

  const handleSave = async () => {
    // 1. Identify new assignments (Keep for backward compatibility if needed, though UI is removed)
    const oldResponsibility = initialFormData?.responsibility || [];
    const newResponsibility = formData.responsibility || [];
    const newlyAssignedResponsible = newResponsibility.filter((id: string) => !oldResponsibility.includes(id));

    const oldSupport = initialFormData?.support || [];
    const newSupport = formData.support || [];
    const newlyAssignedSupport = newSupport.filter((id: string) => !oldSupport.includes(id));

    // 2. Process new assignments (Add as collaborator)
    const processAssignments = async (userIds: string[], roleType: string) => {
      for (const userId of userIds) {
        try {
          // Add as collaborator
          if (projectId) {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/collaborators`, {
              user_id: userId,
              role: 'editor'
            });
          }
        } catch (error) {
          console.error(`Error processing assignment for ${userId}:`, error);
        }
      }
    };

    if (projectId && (newlyAssignedResponsible.length > 0 || newlyAssignedSupport.length > 0)) {
      await processAssignments(newlyAssignedResponsible, 'Responsible');
      await processAssignments(newlyAssignedSupport, 'Support');
    }

    // 3. Save the node data
    onSave(selectedNode.id, formData);
    
    // Update initial form data to current state after save
    setInitialFormData(formData);
  };

  if (!selectedNode) return null;

  const getNodeIcon = () => {
    if (isWorkProduct) return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
    if (isActivity) return <Settings className="w-5 h-5 text-green-500" />;
    if (isDecision) return <AlertCircle className="w-5 h-5 text-orange-500" />;
    if (isProcess) return <Layout className="w-5 h-5 text-purple-500" />;
    if (isDocument) return <FileText className="w-5 h-5 text-gray-500" />;
    return <Info className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="w-85 border-l bg-white h-full overflow-y-auto shadow-2xl absolute right-0 top-0 z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-5 border-b flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            {getNodeIcon()}
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900 leading-tight">
              {selectedNode.data.label || 'Node'}
            </h2>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Properties</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100">
          <X size={18} className="text-slate-500" />
        </Button>
      </div>

      <div className="p-5 space-y-8 flex-1 pb-24">
        {/* Basic Info Section */}
        <div className="space-y-4">
          {!isTextNode && (
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Tag size={16} className="text-blue-500" />
              <h3>Basic Information</h3>
            </div>
          )}
          
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Label</Label>
            <Input
              value={formData.label}
              onChange={(e) => handleChange('label', e.target.value)}
              disabled={isPublished}
              className={cn(
                "bg-white border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 transition-all",
                isPublished && "bg-slate-50 opacity-70"
              )}
              placeholder="Enter node label..."
            />
          </div>

          {!isTextNode && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={isPublished}
                className={cn(
                  "bg-white border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-25 resize-none",
                  isPublished && "bg-slate-50 opacity-70"
                )}
                placeholder="Describe this node's purpose..."
              />
            </div>
          )}
        </div>

        {/* Linked Sheet Section */}
        {(isWorkProduct || isProcess) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Layout size={16} className="text-orange-500" />
              <h3>Linked Flow</h3>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Connect to Sheet</Label>
              <Select
                value={formData.linkedSheetId}
                onValueChange={(val) => handleChange('linkedSheetId', val)}
                disabled={isPublished}
              >
                <SelectTrigger className={cn(
                  "bg-white border-slate-200",
                  isPublished && "bg-slate-50 opacity-70"
                )}>
                  <SelectValue placeholder="Select a sheet to link..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sheets.filter(s => s.id !== 'parent').map(sheet => (
                    <SelectItem key={sheet.id} value={sheet.id}>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-3 h-3 text-slate-400" />
                        {sheet.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400 ml-1 italic">
                Linking a sheet allows users to jump to that specific flow from this node.
              </p>
            </div>
          </div>
        )}

        {!isTextNode && <Separator className="bg-slate-200/60" />}

        {/* State Section */}
        {isWorkProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Info size={16} className="text-indigo-500" />
              <h3>State</h3>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Current State</Label>
              <Select
                value={formData.state}
                onValueChange={(val) => handleStateChange(val)}
                disabled={!!(isPublished || (!canEditVerificationComments() && projectId && projectOwnerId !== user?.id))}
              >
                <SelectTrigger className={cn(
                  "bg-white border-slate-200",
                  (isPublished || (!canEditVerificationComments() && projectId && projectOwnerId !== user?.id)) && "bg-slate-50 opacity-70"
                )}>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Draft">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      Draft
                    </div>
                  </SelectItem>
                  <SelectItem value="Refined">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      Refined
                    </div>
                  </SelectItem>
                  <SelectItem value="Final">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Final
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Comments Section for Work Products in Projects */}
        {isWorkProduct && projectId && (
          <div className="space-y-6">
            <Separator className="bg-slate-200/60" />
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <MessageSquare size={16} className="text-blue-500" />
              <h3>Comments & Feedback</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Author Comments</Label>
                  {!canEditAuthorComments() && (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase text-slate-400 border-slate-200">Read Only</Badge>
                  )}
                </div>
                <Textarea
                  value={formData.authorComments}
                  onChange={(e) => handleCommentChange('authorComments', e.target.value)}
                  disabled={!canEditAuthorComments()}
                  className={cn(
                    "bg-white border-slate-200 min-h-20 resize-none text-sm",
                    !canEditAuthorComments() && "bg-slate-50 opacity-70"
                  )}
                  placeholder="Author's notes and justifications..."
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Viewer Comments</Label>
                  {!canEditReviewerComments() && (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase text-slate-400 border-slate-200">Read Only</Badge>
                  )}
                </div>
                <Textarea
                  value={formData.reviewerComments}
                  onChange={(e) => handleCommentChange('reviewerComments', e.target.value)}
                  disabled={!canEditReviewerComments()}
                  className={cn(
                    "bg-white border-slate-200 min-h-20 resize-none text-sm",
                    !canEditReviewerComments() && "bg-slate-50 opacity-70"
                  )}
                  placeholder="Viewer's feedback and review notes..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Activity Specific Fields */}
        {isActivity && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <Users size={16} className="text-green-500" />
                <h3>Roles & Responsibilities</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                onClick={() => setShowRolesManager(true)}
                disabled={isPublished}
              >
                Manage Members
              </Button>
            </div>

            <div className="grid gap-6">
              {/* Responsibility */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Responsibility</Label>
                <Select 
                  onValueChange={(val) => handleUserSelection('responsibility', val)}
                  value={formData.responsibility?.[0] || ""}
                  disabled={isPublished || loadingUsers}
                >
                  <SelectTrigger className={cn("bg-white border-slate-200", (isPublished || loadingUsers) && "bg-slate-50 opacity-70")}>
                    <SelectValue placeholder={loadingUsers ? 'Loading users...' : 'Select responsible user'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(u => (
                      <SelectItem key={u.clerk_id} value={u.clerk_id}>
                        <div className="flex flex-col py-1">
                          <span className="font-medium text-sm">{u.first_name} {u.last_name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{u.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!projectId && !loadingUsers && availableUsers.length === 0 && (
                  <div className="text-[10px] text-slate-400 italic px-1">No users found to assign.</div>
                )}
                <Textarea
                  value={formData.responsibilitiesDescription}
                  onChange={(e) => handleChange('responsibilitiesDescription', e.target.value)}
                  disabled={isPublished}
                  className={cn(
                    "bg-white border-slate-200 text-sm min-h-20 mt-2",
                    isPublished && "bg-slate-50 opacity-70"
                  )}
                  placeholder="Define specific responsibilities..."
                />
              </div>

              {/* Support */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Support</Label>
                <>
                  <Select 
                    onValueChange={(val) => handleUserSelection('support', val)}
                    value=""
                    disabled={isPublished || loadingUsers}
                  >
                    <SelectTrigger className={cn("bg-white border-slate-200", (isPublished || loadingUsers) && "bg-slate-50 opacity-70")}>
                      <SelectValue placeholder="Add support user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map(u => (
                        <SelectItem key={u.clerk_id} value={u.clerk_id}>
                          <div className="flex flex-col py-1">
                            <span className="font-medium text-sm">{u.first_name} {u.last_name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{u.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {formData.support?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formData.support?.map((userId: string, i: number) => {
                        const user = availableUsers.find(u => u.clerk_id === userId);
                        const displayName = user 
                          ? (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email)
                          : userId;
                        
                        return (
                          <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 py-1 pl-2 pr-1 flex items-center gap-1">
                            <div className="flex flex-col">
                              <span className="text-xs leading-tight">{displayName}</span>
                              {user && <span className="text-[8px] text-slate-400 leading-tight">{user.email}</span>}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-4 w-4 rounded-full hover:bg-slate-200 ml-1"
                              onClick={() => handleArrayRemove('support', i)}
                              disabled={isPublished}
                            >
                              <X size={10} />
                            </Button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </>
                <Textarea
                  value={formData.rolesDescription}
                  onChange={(e) => handleChange('rolesDescription', e.target.value)}
                  disabled={isPublished}
                  className={cn(
                    "bg-white border-slate-200 text-sm min-h-20 mt-2",
                    isPublished && "bg-slate-50 opacity-70"
                  )}
                  placeholder="Define roles involved..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Deadline Section */}
        {isActivity && projectId && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <CalendarIcon size={16} className="text-red-500" />
              <h3>Timeline</h3>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Deadline</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    disabled={isPublished}
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white border-slate-200 hover:bg-slate-50",
                      !formData.deadline && "text-slate-400",
                      isPublished && "bg-slate-50 opacity-70"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.deadline ? format(formData.deadline, "PPP") : <span>Set a deadline</span>}
                  </Button>
                </PopoverTrigger>
                {!isPublished && (
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.deadline}
                      onSelect={(date) => handleChange('deadline', date)}
                      initialFocus
                    />
                  </PopoverContent>
                )}
              </Popover>
            </div>
          </div>
        )}

        {/* Links Section */}
        {(isWorkProduct || isDocument) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <LinkIcon size={16} className="text-blue-500" />
                <h3>Resources & Links</h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => openAddDialog('links')} 
                disabled={isPublished}
                className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
              >
                <Plus size={16} />
              </Button>
            </div>
            
            <div className="space-y-2">
              {formData.links?.length > 0 ? (
                formData.links?.map((link: any, i: number) => {
                  const url = typeof link === 'string' ? link : link.url;
                  const label = typeof link === 'string' ? link : link.label;
                  return (
                    <div key={i} className="group flex items-center gap-3 bg-white border border-slate-200 p-3 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
                      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <LinkIcon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-xs truncate">{label}</div>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 hover:text-blue-600 truncate block">
                          {url}
                        </a>
                      </div>
                      {!isPublished && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleArrayRemove('links', i)} 
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-xs text-slate-400">No resources added yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Appearance Section */}
        {!isTextNode && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Palette size={16} className="text-pink-500" />
              <h3>Appearance</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Background</Label>
                <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-lg">
                  <input
                    type="color"
                    value={formData.backgroundColor || '#ffffff'}
                    onChange={(e) => handleChange('backgroundColor', e.target.value)}
                    className="h-6 w-10 cursor-pointer rounded border-none bg-transparent"
                  />
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {formData.backgroundColor || '#FFFFFF'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Text Color</Label>
                <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-lg">
                  <input
                    type="color"
                    value={formData.textColor || '#000000'}
                    onChange={(e) => handleChange('textColor', e.target.value)}
                    className="h-6 w-10 cursor-pointer rounded border-none bg-transparent"
                  />
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {formData.textColor || '#000000'}
                  </span>
                </div>
              </div>
            </div>

            {/* Font Size & Formatting */}
            {isTextNode && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Typography</Label>
                  <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg">
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleChange('fontSize', Math.max(8, formData.fontSize - 1))}
                      >
                        <Type size={14} className="scale-75" />
                      </Button>
                      <span className="text-xs font-bold w-8 text-center">{formData.fontSize}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleChange('fontSize', Math.min(32, formData.fontSize + 1))}
                      >
                        <Type size={18} />
                      </Button>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <Button 
                      variant={formData.isBold ? "secondary" : "ghost"} 
                      size="icon" 
                      className={cn("h-8 w-8", formData.isBold && "bg-slate-100")}
                      onClick={() => handleChange('isBold', !formData.isBold)}
                    >
                      <span className="font-bold">B</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">H-Align</Label>
                    <div className="flex bg-white border border-slate-200 p-1 rounded-lg">
                      <Button 
                        variant={formData.alignment === 'left' ? "secondary" : "ghost"} 
                        size="icon" className="h-8 flex-1"
                        onClick={() => handleChange('alignment', 'left')}
                      >
                        <AlignLeft size={14} />
                      </Button>
                      <Button 
                        variant={formData.alignment === 'center' ? "secondary" : "ghost"} 
                        size="icon" className="h-8 flex-1"
                        onClick={() => handleChange('alignment', 'center')}
                      >
                        <AlignCenter size={14} />
                      </Button>
                      <Button 
                        variant={formData.alignment === 'right' ? "secondary" : "ghost"} 
                        size="icon" className="h-8 flex-1"
                        onClick={() => handleChange('alignment', 'right')}
                      >
                        <AlignRight size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">V-Align</Label>
                    <Select
                      value={formData.verticalAlignment}
                      onValueChange={(val) => handleChange('verticalAlignment', val)}
                    >
                      <SelectTrigger className="bg-white border-slate-200 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="middle">Middle</SelectItem>
                        <SelectItem value="bottom">Bottom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-5 border-t bg-white flex gap-3 sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          Save Changes
        </Button>
      </div>

      {/* Roles Manager Dialog */}
      <Dialog open={showRolesManager} onOpenChange={setShowRolesManager}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Users size={18} />
              </div>
              Manage Members
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Add Member</Label>
              <Select 
                onValueChange={(val) => handleMemberSelectionForRoles(val)}
                value=""
                disabled={isPublished || loadingUsers}
              >
                <SelectTrigger className={cn("bg-slate-50 border-slate-200", (isPublished || loadingUsers) && "bg-slate-50 opacity-70")}>
                  <SelectValue placeholder={loadingUsers ? 'Loading...' : 'Select a person to add...'} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(u => (
                    <SelectItem key={u.clerk_id} value={u.clerk_id}>
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium text-sm">{u.first_name} {u.last_name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{u.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {formData.roles?.length > 0 ? (
                formData.roles.map((role: string, i: number) => {
                  const user = availableUsers.find(u => u.clerk_id === role);
                  const displayName = user 
                    ? `${user.first_name} ${user.last_name || ''}`.trim()
                    : role;
                  const email = user?.email;

                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-100 transition-all">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700">{displayName}</span>
                        {email && <span className="text-[10px] text-slate-400">{email}</span>}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => handleRemoveRole(i)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-xs text-slate-400 italic">No members added yet</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowRolesManager(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className={cn(isWorkProduct && currentAddField === 'links' ? "sm:max-w-150" : "sm:max-w-106.25", "rounded-2xl")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <LinkIcon size={18} />
              </div>
              {isWorkProduct && currentAddField === 'links' 
                ? 'Add Resource Links' 
                : `Add New ${currentAddField.charAt(0).toUpperCase() + currentAddField.slice(1)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            {isWorkProduct && currentAddField === 'links' ? (
              <div className="grid gap-6">
                {/* Template Section */}
                <div className="space-y-4 p-4 border border-blue-100 rounded-2xl bg-blue-50/30">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500 hover:bg-blue-600">Template</Badge>
                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Optional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Label</Label>
                      <Input 
                        value={templateLabel} 
                        onChange={(e) => setTemplateLabel(e.target.value)} 
                        placeholder="e.g. Design Template" 
                        className="bg-white border-blue-100 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase ml-1">URL</Label>
                      <Input 
                        value={templateUrl} 
                        onChange={(e) => setTemplateUrl(e.target.value)} 
                        placeholder="https://..." 
                        className="bg-white border-blue-100 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Guidelines Section */}
                <div className="space-y-4 p-4 border border-green-100 rounded-2xl bg-green-50/30">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500 hover:bg-green-600">Guidelines</Badge>
                    <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Optional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Label</Label>
                      <Input 
                        value={guidelinesLabel} 
                        onChange={(e) => setGuidelinesLabel(e.target.value)} 
                        placeholder="e.g. Coding Standards" 
                        className="bg-white border-green-100 focus:ring-green-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase ml-1">URL</Label>
                      <Input 
                        value={guidelinesUrl} 
                        onChange={(e) => setGuidelinesUrl(e.target.value)} 
                        placeholder="https://..." 
                        className="bg-white border-green-100 focus:ring-green-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Checklist Section */}
                <div className="space-y-4 p-4 border border-purple-100 rounded-2xl bg-purple-50/30">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-500 hover:bg-purple-600">Checklist</Badge>
                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Optional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Label</Label>
                      <Input 
                        value={checklistLabel} 
                        onChange={(e) => setChecklistLabel(e.target.value)} 
                        placeholder="e.g. Review Checklist" 
                        className="bg-white border-purple-100 focus:ring-purple-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase ml-1">URL</Label>
                      <Input 
                        value={checklistUrl} 
                        onChange={(e) => setChecklistUrl(e.target.value)} 
                        placeholder="https://..." 
                        className="bg-white border-purple-100 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {currentAddField === 'links' && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Link Label</Label>
                    <Input
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      placeholder="Enter label (e.g. Documentation)"
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">
                    {currentAddField === 'links' ? 'URL' : 'Value'}
                  </Label>
                  <Input
                    value={newItemValue}
                    onChange={(e) => setNewItemValue(e.target.value)}
                    placeholder={`Enter ${currentAddField} ${currentAddField === 'links' ? 'URL' : 'value'}...`}
                    className="bg-slate-50 border-slate-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddItem();
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="text-slate-500">Cancel</Button>
            <Button onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700 text-white px-8">Add Resource</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
