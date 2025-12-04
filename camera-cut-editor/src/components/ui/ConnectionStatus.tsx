'use client';

import { useSocketStore } from '@/lib/store/useSocketStore';
import { Wifi, WifiOff, Users } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ConnectionStatus() {
  const isConnected = useSocketStore((state) => state.isConnected);
  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const userName = useSocketStore((state) => state.userName);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Connection status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span>{isConnected ? 'Connected' : 'Offline'}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isConnected
                ? `リアルタイム同期中: ${userName}`
                : 'サーバーに接続されていません'}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Online users count */}
        {isConnected && onlineUsers.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">
                <Users className="h-3 w-3" />
                <span>{onlineUsers.length}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-semibold">オンラインユーザー:</p>
                <ul className="text-sm">
                  {onlineUsers.map((user) => (
                    <li key={user.id}>
                      {user.name}
                      {user.id === useSocketStore.getState().userId && ' (あなた)'}
                    </li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
