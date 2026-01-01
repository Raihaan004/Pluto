import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ExternalLink, FileText, Info, User as UserIcon, Mail, MessageSquare } from 'lucide-react';

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
}

export const NodeInfoDialog = ({ isOpen, onClose, data, users = [] }: NodeInfoDialogProps) => {
  if (!data) return null;

  const getUserDetails = (userId: string) => {
    const user = users.find(u => u.clerk_id === userId);
    if (!user) return { name: userId, email: '', role: '' };
    const name = user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email;
    return { name, email: user.email, role: user.role };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {data.label || 'Untitled Node'}
            {data.state && data.state !== 'None' && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                data.state === 'Final' ? 'bg-green-100 text-green-800 border-green-200' :
                data.state === 'Refined' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                'bg-gray-100 text-gray-800 border-gray-200'
              }`}>
                {data.state}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-gray-500">
              <Info size={16} /> Description
            </h4>
            <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-700 whitespace-pre-wrap">
              {data.description || "No description provided."}
            </div>
          </div>

          {/* Links */}
          {data.links && data.links.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-gray-500">
                <ExternalLink size={16} /> Links
              </h4>
              <div className="flex flex-col gap-2">
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
                      className="text-sm text-blue-600 hover:underline flex flex-col gap-0.5 p-2 hover:bg-blue-50 rounded transition-colors border border-transparent hover:border-blue-100"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <ExternalLink size={14} />
                        {label}
                      </div>
                      {label !== url && <div className="text-xs text-gray-400 ml-5 truncate">{url}</div>}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comments */}
          {(data.verificationComments || data.authorComments) && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-gray-500">
                <MessageSquare size={16} /> Comments
              </h4>
              <div className="space-y-2">
                {data.verificationComments && (
                  <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-md">
                    <span className="text-xs font-semibold text-yellow-800 uppercase mb-1 block">Verification Comments</span>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.verificationComments}</p>
                  </div>
                )}
                {data.authorComments && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
                    <span className="text-xs font-semibold text-blue-800 uppercase mb-1 block">Author Comments</span>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.authorComments}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Roles */}
          {(data.responsibility?.length > 0 || data.support?.length > 0) && (
             <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2 text-gray-500">
                  Roles
                </h4>
                <div className="grid grid-cols-1 gap-4">
                    {data.responsibility?.length > 0 && (
                        <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Responsible</span>
                            <div className="flex flex-col gap-2">
                                {data.responsibility.map((r: string, i: number) => {
                                    const user = getUserDetails(r);
                                    return (
                                        <div key={i} className="flex items-start gap-3 p-2 bg-blue-50 rounded-md border border-blue-100">
                                            <div className="bg-blue-200 p-1.5 rounded-full">
                                                <UserIcon size={14} className="text-blue-700" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                                                {user.email && (
                                                    <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                                                        <Mail size={10} /> {user.email}
                                                    </p>
                                                )}
                                            </div>
                                            {user.role && (
                                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-white text-blue-600 rounded border border-blue-200">
                                                    {user.role}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {data.support?.length > 0 && (
                        <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Support</span>
                            <div className="flex flex-col gap-2">
                                {data.support.map((r: string, i: number) => {
                                    const user = getUserDetails(r);
                                    return (
                                        <div key={i} className="flex items-start gap-3 p-2 bg-gray-50 rounded-md border border-gray-200">
                                            <div className="bg-gray-200 p-1.5 rounded-full">
                                                <UserIcon size={14} className="text-gray-700" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                                                {user.email && (
                                                    <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                                                        <Mail size={10} /> {user.email}
                                                    </p>
                                                )}
                                            </div>
                                            {user.role && (
                                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-white text-gray-600 rounded border border-gray-200">
                                                    {user.role}
                                                </span>
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
      </DialogContent>
    </Dialog>
  );
};
