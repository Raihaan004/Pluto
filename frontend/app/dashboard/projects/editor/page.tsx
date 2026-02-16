'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import CreateProcessPage from "../../process/create/page";
import TableProcessPage from "../../process/table/page";
import { Loader2 } from 'lucide-react';

function EditorContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [loading, setLoading] = useState(true);
  const [isTableStyle, setIsTableStyle] = useState(false);

  useEffect(() => {
    async function checkProjectStyle() {
      if (!projectId) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`);
        const project = response.data;
        
        // Use the explicit type field if available, otherwise fallback to heuristic
        if (project.type === 'table') {
          setIsTableStyle(true);
        } else if (project.type === 'freestyle') {
          setIsTableStyle(false);
        } else {
          // Fallback heuristic for older projects
          const firstSheet = project.sheets?.[0];
          if (firstSheet && (Object.keys(firstSheet.cellData || {}).length > 0 || firstSheet.columnWidths)) {
            setIsTableStyle(true);
          } else {
            setIsTableStyle(false);
          }
        }
      } catch (error) {
        console.error("Failed to check project style:", error);
      } finally {
        setLoading(false);
      }
    }

    checkProjectStyle();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-gray-500">Loading project editor...</p>
        </div>
      </div>
    );
  }

  if (isTableStyle) {
    return <TableProcessPage />;
  }

  return <CreateProcessPage />;
}

export default function ProjectEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
