import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useUser } from '@clerk/nextjs';

interface PropertiesPanelProps {
  selectedNode: any;
  onSave: (nodeId: string, data: any) => void;
  onClose: () => void;
}

interface User {
  clerk_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

export const PropertiesPanel = ({ selectedNode, onSave, onClose }: PropertiesPanelProps) => {
  const { user } = useUser();
  const [formData, setFormData] = useState<any>({
    label: '',
    state: 'Draft',
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
    description: ''
  });

  const [showRolesManager, setShowRolesManager] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
      setFormData({
        label: selectedNode.data.label || '',
        state: selectedNode.data.state || 'Draft',
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
        description: selectedNode.data.description || ''
      });
    }
  }, [selectedNode]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleArrayAdd = (field: string) => {
    const value = prompt(`Add new ${field.slice(0, -1)}:`);
    if (value) {
      setFormData((prev: any) => ({
        ...prev,
        [field]: [...(prev[field] || []), value]
      }));
    }
  };

  const handleArrayRemove = (field: string, index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: prev[field].filter((_: any, i: number) => i !== index)
    }));
  };

  const handleUserSelection = async (field: string, userId: string) => {
      if (!userId) return;
      
      const selectedUser = availableUsers.find(u => u.clerk_id === userId);
      if (!selectedUser) return;

      // For responsibility, we only want ONE user, not an array
      if (field === 'responsibility') {
          setFormData((prev: any) => ({
              ...prev,
              [field]: [userId] // Store ID, not name, for easier permission checks
          }));

          // Send notification
          try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/notifications`, {
              user_id: userId,
              type: 'info',
              title: 'New Responsibility Assigned',
              message: `You have been assigned as Responsible for the node "${formData.label || 'Untitled'}" by ${user?.fullName || user?.primaryEmailAddress?.emailAddress}.`,
              read: false
            });
            alert(`Notification sent to ${selectedUser.first_name || selectedUser.email}`);
          } catch (error) {
            console.error('Error sending notification:', error);
          }
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

  const handleAddRole = () => {
    if (newRoleName.trim()) {
      setFormData((prev: any) => ({
        ...prev,
        roles: [...(prev.roles || []), newRoleName.trim()]
      }));
      setNewRoleName('');
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
    // Since we don't have the full role context, let's fetch the current user's role from the availableUsers list if possible
    // (assuming the current user is in the list)
    const currentUser = availableUsers.find(u => u.clerk_id === user?.id);
    const isAdmin = currentUser?.role === 'admin';
    
    const responsibleId = formData.responsibility?.[0];
    const isResponsible = responsibleId === user?.id;

    if (isAdmin || isResponsible || !responsibleId) {
        handleChange('state', newState);
    } else {
        alert("You do not have permission to change the state of this node.");
    }
  };

  const handleSave = () => {
    onSave(selectedNode.id, formData);
  };

  if (!selectedNode) return null;

  return (
    <div className="w-80 border-l bg-white h-full overflow-y-auto shadow-xl absolute right-0 top-0 z-50 flex flex-col">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h2 className="font-bold text-lg text-gray-800">{selectedNode.data.label || 'Node'} Properties</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Label */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Label</label>
          <input
            type="text"
            value={formData.label}
            onChange={(e) => handleChange('label', e.target.value)}
            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
            placeholder="Enter work product description"
          />
        </div>

        {/* State */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">State</label>
          <select
            value={formData.state}
            onChange={(e) => handleStateChange(e.target.value)}
            className="w-full p-2 border rounded-md text-sm outline-none"
          >
            <option value="Draft">Draft</option>
            <option value="Review">Review</option>
            <option value="Published">Published</option>
          </select>
        </div>

        {/* Roles & Responsibilities Section */}
        <div className="space-y-4 border-t pt-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-gray-800">Roles & Responsibilities</h3>
                <button 
                  onClick={() => setShowRolesManager(!showRolesManager)}
                  className="bg-green-600 text-white text-xs px-2 py-1 rounded hover:bg-green-700 transition-colors"
                >
                  {showRolesManager ? 'Hide' : 'Manage Roles'}
                </button>
            </div>

            {showRolesManager && (
              <div className="p-3 bg-gray-50 rounded-md border space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Enter role name"
                    className="flex-1 p-1.5 text-sm border rounded"
                  />
                  <button onClick={handleAddRole} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.roles.map((role: string, index: number) => (
                    <div key={index} className="bg-white border px-2 py-1 rounded text-xs flex items-center gap-1">
                      {role}
                      <button onClick={() => handleRemoveRole(index)} className="text-red-500 hover:text-red-700">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Responsibility */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Responsibility</label>
                <select 
                    className="w-full p-2 border rounded-md text-sm outline-none"
                    onChange={(e) => handleUserSelection('responsibility', e.target.value)}
                    value={formData.responsibility?.[0] || ""}
                    disabled={loadingUsers}
                >
                    <option value="" disabled>
                        {loadingUsers ? 'Loading users...' : 'Select a user...'}
                    </option>
                    {availableUsers.map(u => (
                        <option key={u.clerk_id} value={u.clerk_id}>
                            {u.first_name} {u.last_name} ({u.email})
                        </option>
                    ))}
                </select>
            </div>

            {/* Support */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Support</label>
                <select 
                    className="w-full p-2 border rounded-md text-sm outline-none"
                    onChange={(e) => handleUserSelection('support', e.target.value)}
                    value=""
                    disabled={loadingUsers}
                >
                    <option value="" disabled>Select a user...</option>
                    {availableUsers.map(u => (
                        <option key={u.clerk_id} value={u.clerk_id}>
                            {u.first_name} {u.last_name} ({u.email})
                        </option>
                    ))}
                </select>
                <div className="flex flex-wrap gap-1 mt-2">
                    {formData.support?.map((userId: string, i: number) => {
                        const user = availableUsers.find(u => u.clerk_id === userId);
                        const displayName = user 
                            ? (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email)
                            : userId; // Fallback to ID if not found (or if it was a legacy name)
                        
                        return (
                            <span key={i} className="bg-gray-100 text-xs px-2 py-1 rounded flex items-center gap-1">
                                {displayName}
                                <button onClick={() => handleArrayRemove('support', i)}><X size={12}/></button>
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Links */}
        <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Links</label>
                <button onClick={() => handleArrayAdd('links')} className="text-blue-600 hover:text-blue-800">
                    <Plus size={16} />
                </button>
            </div>
            <div className="space-y-2">
                {formData.links?.map((link: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded text-sm">
                        <span className="flex-1 truncate">{link}</span>
                        <button onClick={() => handleArrayRemove('links', i)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>


        {/* Colors */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Background</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.backgroundColor || '#ffffff'}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="h-8 w-full cursor-pointer rounded border"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.textColor || '#000000'}
                onChange={(e) => handleChange('textColor', e.target.value)}
                className="h-8 w-full cursor-pointer rounded border"
              />
            </div>
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Font Size</label>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleChange('fontSize', Math.max(8, formData.fontSize - 1))}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
            >
              A-
            </button>
            <span className="text-sm font-medium w-12 text-center">{formData.fontSize}px</span>
            <button 
              onClick={() => handleChange('fontSize', Math.min(32, formData.fontSize + 1))}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm"
            >
              A+
            </button>
          </div>
        </div>

        {/* Text Formatting */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-gray-800 border-b pb-1">Text Formatting</h3>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="bold"
              checked={formData.isBold}
              onChange={(e) => handleChange('isBold', e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="bold" className="text-sm text-gray-700">Bold Text</label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Horizontal Alignment</label>
            <select
              value={formData.alignment}
              onChange={(e) => handleChange('alignment', e.target.value)}
              className="w-full p-2 border rounded-md text-sm outline-none"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Vertical Alignment</label>
            <select
              value={formData.verticalAlignment}
              onChange={(e) => handleChange('verticalAlignment', e.target.value)}
              className="w-full p-2 border rounded-md text-sm outline-none"
            >
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="wrap"
              checked={formData.wrapText}
              onChange={(e) => handleChange('wrapText', e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="wrap" className="text-sm text-gray-700">Wrap Text</label>
          </div>
        </div>

        {/* Metadata Sections */}
        {['Templates', 'Guidelines', 'Checklists'].map((section) => {
            const field = section.toLowerCase();
            return (
                <div key={section} className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-gray-800">{section}</label>
                    </div>
                    <div className="space-y-2">
                        {formData[field]?.map((item: string, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                                <span className="truncate">{item}</span>
                                <button onClick={() => handleArrayRemove(field, idx)} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={() => handleArrayAdd(field)}
                            className="w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                            <Plus size={14} /> Add {section.slice(0, -1)}
                        </button>
                    </div>
                </div>
            )
        })}

        {/* Description */}
        <div className="space-y-2">
            <label className="text-sm font-bold text-gray-800">Description</label>
            <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full p-2 border rounded-md text-sm h-24 outline-none resize-none"
                placeholder="Enter description..."
            />
        </div>

      </div>

      <div className="p-4 border-t bg-gray-50 flex gap-2">
        <button 
            onClick={onClose}
            className="flex-1 py-2 bg-gray-500 text-white rounded-md text-sm font-medium hover:bg-gray-600"
        >
            Cancel
        </button>
        <button 
            onClick={handleSave}
            className="flex-1 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
        >
            Save Changes
        </button>
      </div>
    </div>
  );
};
