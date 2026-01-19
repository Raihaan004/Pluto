'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import CreateProcessPage from '../dashboard/process/create/page';
import { Loader2 } from 'lucide-react';

function JiraProjectViewer() {
  const searchParams = useSearchParams();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Jira Forge passes project key and other context via URL params or bridge
  const jiraProjectKey = searchParams.get('projectKey');

  useEffect(() => {
    async function fetchProjectMapping() {
      if (!jiraProjectKey) {
        setError('No Jira Project Key provided in context.');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/project/jira/${jiraProjectKey}`);
        if (response.data.error) {
          setError(response.data.error);
        } else if (response.data.id) {
          setProjectId(response.data.id.toString());
        } else {
          setError('Project not found for this Jira key.');
        }
      } catch (err) {
        console.error('Error fetching project mapping:', err);
        setError('Failed to load project mapping.');
      } finally {
        setLoading(false);
      }
    }

    fetchProjectMapping();
  }, [jiraProjectKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-slate-500 animate-pulse">Loading Pluto Workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center">
        <div className="bg-red-50 p-6 rounded-lg border border-red-100">
          <h2 className="text-xl font-bold text-red-700 mb-2">Workspace Not Linked</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-sm text-red-500">
            Ensure you have published your Pluto project and linked it to this Jira Project Key ({jiraProjectKey}).
          </p>
        </div>
      </div>
    );
  }

  // Force ReadOnly and Published mode for Jira View
  return <CreateProcessPage initialProjectId={projectId} forceReadOnly={true} forcePublished={true} />;
}

export default function JiraPage() {
  return (
    <Suspense fallback={
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    }>
      <JiraProjectViewer />
    </Suspense>
  );
}
