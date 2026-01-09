import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ExternalLink, 
  Info, 
  User as UserIcon, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  Settings, 
  Tag,
  Users,
  Link as LinkIcon,
  ShieldCheck,
  UserCheck,
  Layout
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface User {
  clerk_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  image_url?: string;
}

interface NodeInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  users: User[];
  onViewSheet?: (sheetId: string) => void;
  sheets?: any[];
}

export const NodeInfoDialog = ({ isOpen, onClose, data, users = [], onViewSheet, sheets = [] }: NodeInfoDialogProps) => {
  if (!data) return null;

  const getLinkedSheetName = (sheetId: string) => {
    const sheet = sheets.find((s: any) => s.id === sheetId);
    return sheet ? sheet.name : 'Unknown Sheet';
  };

  const handleViewSheet = () => {
    if (onViewSheet && data.linkedSheetId) {
      onViewSheet(data.linkedSheetId);
      onClose();
    }
  };

  const getUserDetails = (userId: string) => {
    const user = users.find((u: any) => u.clerk_id === userId);
    if (!user) return { name: userId, email: '', role: '', image: '' };
    const name = user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email;
    return { name, email: user.email, role: user.role, image: user.image_url };
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'Final': return 'bg-green-500 text-white border-green-600';
      case 'Refined': return 'bg-blue-500 text-white border-blue-600';
      case 'Draft': return 'bg-slate-400 text-white border-slate-500';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getNodeIcon = () => {
    if (data.type === 'activity') return <Settings className="w-5 h-5 text-green-500" />;
    if (data.type === 'workProduct') return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
    if (data.type === 'decision') return <ShieldCheck className="w-5 h-5 text-orange-500" />;
    if (data.type === 'process') return <Settings className="w-5 h-5 text-purple-500" />;
    if (data.type === 'document') return <ExternalLink className="w-5 h-5 text-gray-500" />;
    return <Info className="w-5 h-5 text-blue-500" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-150 p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <div className="bg-slate-50/50 backdrop-blur-sm">
          {/* Header */}
          <div className="p-6 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-slate-100 rounded-xl">
                {getNodeIcon()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    {data.label || 'Untitled Node'}
                  </DialogTitle>
                  {data.state && data.state !== 'None' && (
                    <Badge className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5", getStatusColor(data.state))}>
                      {data.state}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-0.5">Node Information</p>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[70vh] custom-scrollbar">
            <div className="p-6 space-y-8 pb-20">
              {/* Linked Sheet Section */}
              {data.linkedSheetId && data.linkedSheetId !== 'none' && (
                <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                      <Layout size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest leading-tight">Linked Flow</p>
                      <p className="text-sm font-bold text-slate-800">{getLinkedSheetName(data.linkedSheetId)}</p>
                    </div>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleViewSheet}
                    className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-9 px-4 text-xs font-bold transition-all shadow-sm"
                  >
                    View Sheet <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </div>
              )}

              {/* Description Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Tag size={16} className="text-blue-500" />
                  <h3>Description</h3>
                </div>
                <Card className="border-slate-200 shadow-none bg-white/80">
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {data.description || "No description provided for this node."}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Links Section */}
              {data.links && data.links.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                    <LinkIcon size={16} className="text-indigo-500" />
                    <h3>Resources & Links</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.links.map((link: any, i: number) => {
                      const url = typeof link === 'string' ? link : link.url;
                      const label = typeof link === 'string' ? link : link.label;
                      const href = url.startsWith('http') ? url : `https://${url}`;
                      
                      return (
                        <a 
                          key={i} 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 bg-white border border-slate-200 p-3 rounded-xl hover:border-blue-200 hover:shadow-md transition-all duration-200"
                        >
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <ExternalLink size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 text-xs truncate">{label}</div>
                            <div className="text-[10px] text-slate-400 truncate">{url}</div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              {data.type !== 'activity' && (data.verificationComments || data.authorComments || data.reviewerComments) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                    <MessageSquare size={16} className="text-pink-500" />
                    <h3>Comments & Feedback</h3>
                  </div>
                  <div className="space-y-3">
                    {data.verificationComments && (
                      <div className="relative overflow-hidden p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck size={14} className="text-amber-600" />
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Verification</span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.verificationComments}</p>
                      </div>
                    )}
                    {data.authorComments && (
                      <div className="relative overflow-hidden p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                          <UserCheck size={14} className="text-blue-600" />
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Author</span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.authorComments}</p>
                      </div>
                    )}
                    {data.reviewerComments && (
                      <div className="relative overflow-hidden p-4 bg-purple-50/50 border border-purple-100 rounded-2xl">
                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-400" />
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck size={14} className="text-purple-600" />
                          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Viewer</span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.reviewerComments}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Activity Details Section */}
              {(data.rolesDescription || data.responsibilitiesDescription) && (
                <div className="space-y-4">
                  <Separator className="bg-slate-200/60" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.rolesDescription && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Roles</Label>
                        <div className="p-4 bg-white border border-slate-200 rounded-2xl text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {data.rolesDescription}
                        </div>
                      </div>
                    )}
                    {data.responsibilitiesDescription && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Responsibilities</Label>
                        <div className="p-4 bg-white border border-slate-200 rounded-2xl text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {data.responsibilitiesDescription}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Team Section */}
              {(data.responsibility?.length > 0 || data.support?.length > 0) && (
                <div className="space-y-4">
                  <Separator className="bg-slate-200/60" />
                  <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                    <Users size={16} className="text-green-500" />
                    <h3>Assigned Team</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {data.responsibility?.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Responsible</Label>
                        <div className="space-y-2">
                          {data.responsibility.map((r: string, i: number) => {
                            const user = getUserDetails(r);
                            return (
                              <div key={i} className="flex items-center gap-3 p-3 bg-white border border-blue-100 rounded-2xl shadow-sm">
                                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                                  <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                                    <Mail size={10} /> {user.email}
                                  </p>
                                </div>
                                {user.role && (
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase bg-blue-50 text-blue-600 border-blue-100">
                                    {user.role}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {data.support?.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Support</Label>
                        <div className="space-y-2">
                          {data.support.map((r: string, i: number) => {
                            const user = getUserDetails(r);
                            return (
                              <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 font-bold border border-slate-100">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                                  <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                                    <Mail size={10} /> {user.email}
                                  </p>
                                </div>
                                {user.role && (
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase bg-slate-50 text-slate-600 border-slate-100">
                                    {user.role}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
