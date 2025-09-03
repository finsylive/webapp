import { format, isToday, isYesterday, differenceInDays, differenceInMinutes, differenceInHours } from 'date-fns';

export function formatMessageTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  
  if (differenceInDays(new Date(), date) < 7) {
    return format(date, 'EEEE'); // Day name
  }
  
  return format(date, 'MM/dd/yy');
}

export function formatConversationTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const minutesAgo = differenceInMinutes(now, date);
  const hoursAgo = differenceInHours(now, date);
  const daysAgo = differenceInDays(now, date);

  if (minutesAgo < 1) {
    return 'now';
  }
  
  if (minutesAgo < 60) {
    return `${minutesAgo}m`;
  }
  
  if (hoursAgo < 24) {
    return `${hoursAgo}h`;
  }
  
  if (daysAgo === 1) {
    return 'yesterday';
  }
  
  if (daysAgo < 7) {
    return `${daysAgo}d`;
  }
  
  if (daysAgo < 365) {
    return format(date, 'MMM d');
  }
  
  return format(date, 'MMM d, yyyy');
}

export function formatFullTimestamp(timestamp: string | Date): string {
  const date = new Date(timestamp);
  
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  }
  
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }
  
  if (differenceInDays(new Date(), date) < 7) {
    return `${format(date, 'EEEE')} at ${format(date, 'h:mm a')}`;
  }
  
  return format(date, 'MMM d, yyyy \'at\' h:mm a');
}

export function formatRelativeTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const minutesAgo = differenceInMinutes(now, date);
  const hoursAgo = differenceInHours(now, date);
  const daysAgo = differenceInDays(now, date);

  if (minutesAgo < 1) {
    return 'just now';
  }
  
  if (minutesAgo < 60) {
    return minutesAgo === 1 ? '1 minute ago' : `${minutesAgo} minutes ago`;
  }
  
  if (hoursAgo < 24) {
    return hoursAgo === 1 ? '1 hour ago' : `${hoursAgo} hours ago`;
  }
  
  if (daysAgo === 1) {
    return 'yesterday';
  }
  
  if (daysAgo < 7) {
    return `${daysAgo} days ago`;
  }
  
  if (daysAgo < 30) {
    const weeksAgo = Math.floor(daysAgo / 7);
    return weeksAgo === 1 ? '1 week ago' : `${weeksAgo} weeks ago`;
  }
  
  if (daysAgo < 365) {
    const monthsAgo = Math.floor(daysAgo / 30);
    return monthsAgo === 1 ? '1 month ago' : `${monthsAgo} months ago`;
  }
  
  const yearsAgo = Math.floor(daysAgo / 365);
  return yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`;
}

export function isOlderThan(timestamp: string | Date, hours: number): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  return differenceInHours(now, date) > hours;
}

export function groupMessagesByDate(messages: Array<{ created_at: string; [key: string]: unknown }>) {
  const groups: { [key: string]: typeof messages } = {};
  
  messages.forEach(message => {
    const date = new Date(message.created_at);
    let key: string;
    
    if (isToday(date)) {
      key = 'Today';
    } else if (isYesterday(date)) {
      key = 'Yesterday';
    } else if (differenceInDays(new Date(), date) < 7) {
      key = format(date, 'EEEE');
    } else {
      key = format(date, 'MMMM d, yyyy');
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(message);
  });
  
  return groups;
}