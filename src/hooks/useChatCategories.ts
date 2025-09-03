import { useState, useEffect, useCallback } from 'react';
import type { ChatCategory, CreateCategoryRequest } from '@/types/messaging';

export function useChatCategories(userId: string) {
  const [categories, setCategories] = useState<ChatCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/chat-categories?userId=${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch categories');
      }

      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(async (request: CreateCategoryRequest) => {
    try {
      const response = await fetch('/api/chat-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(request)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create category');
      }

      // Add to local state
      setCategories(prev => [...prev, data.category]);

      return data.category;
    } catch (err) {
      console.error('Error creating category:', err);
      throw err;
    }
  }, [userId]);

  const updateCategory = useCallback(async (id: string, updates: Partial<Pick<ChatCategory, 'name' | 'color'>>) => {
    try {
      const response = await fetch('/api/chat-categories', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update category');
      }

      // Update local state
      setCategories(prev => prev.map(cat => 
        cat.id === id ? { ...cat, ...updates } : cat
      ));

      return data;
    } catch (err) {
      console.error('Error updating category:', err);
      throw err;
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/chat-categories?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete category');
      }

      // Remove from local state
      setCategories(prev => prev.filter(cat => cat.id !== id));
    } catch (err) {
      console.error('Error deleting category:', err);
      throw err;
    }
  }, []);

  const assignConversationToCategory = useCallback(async (conversationId: string, categoryId: string) => {
    try {
      const response = await fetch('/api/conversation-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          category_id: categoryId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign category');
      }

      // Update local state - add conversation to category
      setCategories(prev => prev.map(cat => {
        if (cat.id === categoryId) {
          const currentIds = cat.conversation_ids || [];
          if (!currentIds.includes(conversationId)) {
            return {
              ...cat,
              conversation_ids: [...currentIds, conversationId]
            };
          }
        }
        return cat;
      }));

      return data;
    } catch (err) {
      console.error('Error assigning category:', err);
      throw err;
    }
  }, [userId]);

  const removeConversationFromCategory = useCallback(async (conversationId: string, categoryId: string) => {
    try {
      // Find the assignment record first
      const response = await fetch(`/api/conversation-categories?conversationId=${conversationId}`);
      const assignments = await response.json();
      
      const assignment = assignments.find((a: {
        id: string;
        category_id: string;
        conversation_id: string;
      }) => a.category_id === categoryId);
      if (!assignment) {
        throw new Error('Assignment not found');
      }

      const deleteResponse = await fetch(`/api/conversation-categories?id=${assignment.id}`, {
        method: 'DELETE'
      });

      if (!deleteResponse.ok) {
        const data = await deleteResponse.json();
        throw new Error(data.error || 'Failed to remove category assignment');
      }

      // Update local state - remove conversation from category
      setCategories(prev => prev.map(cat => {
        if (cat.id === categoryId && cat.conversation_ids) {
          return {
            ...cat,
            conversation_ids: cat.conversation_ids.filter(id => id !== conversationId)
          };
        }
        return cat;
      }));
    } catch (err) {
      console.error('Error removing category assignment:', err);
      throw err;
    }
  }, []);

  // Get total unread count across all categories
  const totalUnreadCount = categories.reduce((total, cat) => total + (cat.unread_count || 0), 0);

  // Get category by ID
  const getCategoryById = useCallback((id: string) => {
    return categories.find(cat => cat.id === id);
  }, [categories]);

  // Get categories with conversations
  const getCategoriesWithConversations = useCallback(() => {
    return categories.filter(cat => (cat.conversation_ids?.length || 0) > 0);
  }, [categories]);

  return {
    categories,
    loading,
    error,
    totalUnreadCount,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    assignConversationToCategory,
    removeConversationFromCategory,
    getCategoryById,
    getCategoriesWithConversations
  };
}