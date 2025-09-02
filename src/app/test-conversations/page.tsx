"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function TestConversationsPage() {
  const { user } = useAuth();
  const [otherUserId, setOtherUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const createTestConversation = async () => {
    if (!user?.id || !otherUserId) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1_id: user.id,
          user2_id: otherUserId,
        }),
      });
      
      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/conversations?userId=${user.id}`);
      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Conversations</h1>
      
      <div className="space-y-4">
        <div>
          <p><strong>Current User ID:</strong> {user?.id || 'Not logged in'}</p>
        </div>
        
        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-4">Create Test Conversation</h2>
          <input
            type="text"
            placeholder="Other User ID"
            value={otherUserId}
            onChange={(e) => setOtherUserId(e.target.value)}
            className="border p-2 rounded mr-2"
          />
          <button
            onClick={createTestConversation}
            disabled={loading || !user?.id || !otherUserId}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Create Conversation
          </button>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-4">Fetch Conversations</h2>
          <button
            onClick={fetchConversations}
            disabled={loading || !user?.id}
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Fetch Conversations
          </button>
        </div>

        {result && (
          <div className="border p-4 rounded bg-gray-100">
            <h3 className="font-semibold mb-2">Result:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}