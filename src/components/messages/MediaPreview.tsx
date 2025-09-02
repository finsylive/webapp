"use client";

import React, { useState } from 'react';
import { X, Download, Eye, FileText, Image as ImageIcon, Film, Music, Archive } from 'lucide-react';
import { useTheme } from '@/context/theme/ThemeContext';
import Image from 'next/image';

interface MediaItem {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  thumbnail?: string;
}

interface MediaPreviewProps {
  items: MediaItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  className?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return ImageIcon;
  if (type.startsWith('video/')) return Film;
  if (type.startsWith('audio/')) return Music;
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return Archive;
  return FileText;
};

const getFileColor = (type: string): string => {
  if (type.startsWith('image/')) return 'text-blue-500';
  if (type.startsWith('video/')) return 'text-purple-500';
  if (type.startsWith('audio/')) return 'text-green-500';
  if (type.includes('pdf')) return 'text-red-500';
  if (type.includes('zip') || type.includes('rar')) return 'text-orange-500';
  return 'text-gray-500';
};

export default function MediaPreview({ items, onRemove, onClear, className = '' }: MediaPreviewProps) {
  const { isDarkMode } = useTheme();
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <div className={`border-t border-gray-200 dark:border-gray-700 p-3 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-medium ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {items.length} file{items.length > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClear}
            className={`text-sm text-red-500 hover:text-red-600 transition-colors`}
          >
            Clear all
          </button>
        </div>

        <div className="space-y-2 max-h-32 overflow-y-auto">
          {items.map((item) => {
            const IconComponent = getFileIcon(item.type);
            const isImage = item.type.startsWith('image/');

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                  isDarkMode
                    ? 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {/* Thumbnail or Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  {isImage && item.thumbnail ? (
                    <Image
                      src={item.thumbnail}
                      alt={item.name}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full cursor-pointer"
                      onClick={() => setExpandedImage(item.url)}
                    />
                  ) : (
                    <IconComponent className={`h-5 w-5 ${getFileColor(item.type)}`} />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {item.name}
                  </div>
                  <div className={`text-xs ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {formatFileSize(item.size)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {isImage && (
                    <button
                      onClick={() => setExpandedImage(item.url)}
                      className={`p-1 rounded-full transition-colors ${
                        isDarkMode
                          ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                          : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                      }`}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(item.id)}
                    className={`p-1 rounded-full transition-colors ${
                      isDarkMode
                        ? 'hover:bg-red-900/50 text-gray-400 hover:text-red-400'
                        : 'hover:bg-red-50 text-gray-500 hover:text-red-600'
                    }`}
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Image Preview Modal */}
      {expandedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <div className="relative">
              <Image
                src={expandedImage}
                alt="Preview"
                width={800}
                height={600}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <a
                  href={expandedImage}
                  download
                  className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                  title="Download"
                >
                  <Download className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}