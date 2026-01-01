'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Plus, Minus, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';

interface Project {
    id: number;
    name: string;
    version_name?: string;
    progress?: number;
    auto_progress?: number;
}

interface ProjectProgressGraphProps {
    projects: Project[];
    userId: string;
}

export default function ProjectProgressGraph({ projects, userId }: ProjectProgressGraphProps) {
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [isUpdating, setIsUpdating] = useState(false);
    const router = useRouter();

    const selectedProject = projects?.find(p => p.id.toString() === selectedProjectId);
    const currentProgress = selectedProject?.progress || 0;

    const updateProgress = async (newProgress: number) => {
        if (!selectedProjectId) return;
        
        setIsUpdating(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/project/${selectedProjectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Clerk-User-Id': userId
                },
                body: JSON.stringify({ progress: Math.max(0, Math.min(100, newProgress)) })
            });

            if (response.ok) {
                router.refresh();
            }
        } catch (error) {
            console.error("Failed to update progress:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Card className="border-none shadow-lg bg-white overflow-hidden rounded-2xl h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
                <CardTitle className="text-xl font-bold text-slate-800">Activity Overview</CardTitle>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Settings2 className="h-4 w-4" />
                            Manage Progress
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Update Project Progress</h4>
                                <p className="text-sm text-muted-foreground">
                                    Manually set the blue bar progress for a project.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <div className="grid gap-1">
                                    <Label htmlFor="project">Project</Label>
                                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                                        <SelectTrigger id="project">
                                            <SelectValue placeholder="Select a project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {projects?.map((project) => (
                                                <SelectItem key={project.id} value={project.id.toString()}>
                                                    {project.name} ({project.version_name})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {selectedProjectId && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            onClick={() => updateProgress(currentProgress - 5)}
                                            disabled={isUpdating || currentProgress <= 0}
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <div className="flex-1">
                                            <Input 
                                                type="number" 
                                                value={currentProgress} 
                                                onChange={(e) => updateProgress(parseInt(e.target.value) || 0)}
                                                className="text-center font-bold"
                                                min={0}
                                                max={100}
                                            />
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            onClick={() => updateProgress(currentProgress + 5)}
                                            disabled={isUpdating || currentProgress >= 100}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                                {isUpdating && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Updating...
                                    </div>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </CardHeader>
            <CardContent className="p-6 flex-1 min-h-0">
                <div className="h-full w-full relative">
                    {projects?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <p>No projects found</p>
                        </div>
                    ) : (
                        <div className="flex h-full w-full">
                            {/* Y-Axis Labels */}
                            <div className="flex flex-col justify-between text-[10px] text-slate-400 pr-2 pb-8">
                                <span>100</span>
                                <span>75</span>
                                <span>50</span>
                                <span>25</span>
                                <span>0</span>
                            </div>

                            {/* Chart Area */}
                            <div className="flex-1 flex flex-col">
                                <div className="flex-1 flex items-end justify-around border-l border-b border-slate-200 pb-2 relative">
                                    {/* Grid Lines */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                        <div className="border-t border-slate-100 w-full h-0" />
                                        <div className="border-t border-slate-100 w-full h-0" />
                                        <div className="border-t border-slate-100 w-full h-0" />
                                        <div className="border-t border-slate-100 w-full h-0" />
                                        <div className="h-0" />
                                    </div>

                                    {projects?.slice(0, 5).map((project) => (
                                        <div key={project.id} className="flex flex-col items-center gap-2 group relative h-full">
                                            <div className="flex items-end gap-1 flex-1 w-full">
                                                {/* Blue Bar (Manual) */}
                                                <div 
                                                    className="w-6 bg-sky-400 rounded-t-sm transition-all duration-500 relative"
                                                    style={{ height: `${project.progress || 0}%` }}
                                                >
                                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {project.progress || 0}
                                                    </div>
                                                </div>
                                                {/* Green Bar (Auto) */}
                                                <div 
                                                    className="w-6 bg-teal-300 rounded-t-sm transition-all duration-500 relative"
                                                    style={{ height: `${project.auto_progress || 0}%` }}
                                                >
                                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {project.auto_progress || 0}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-medium truncate max-w-20 text-center">
                                                {project.name} <span className="text-slate-400 text-[9px]">({project.version_name})</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="pl-4 flex flex-col gap-2 pt-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-sky-400 rounded-sm" />
                                    <span className="text-[10px] text-slate-500">Manual</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-teal-300 rounded-sm" />
                                    <span className="text-[10px] text-slate-500">Auto</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
