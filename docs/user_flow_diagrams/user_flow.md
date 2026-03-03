# Ments — Full User Flow (Mermaid)

> To use with [mermaid.live](https://mermaid.live), paste only the content inside a single code block (without the triple backticks).

---

## 1. Top-Level App Entry

```mermaid
flowchart TD
    A([User visits Ments]) --> B{Has session cookie?}
    B -- Yes --> C{Session valid?}
    B -- No --> D["auth - Sign In Page"]
    C -- Yes --> E{Onboarding complete?}
    C -- No --> D
    E -- Yes --> F["hub - Feed"]
    E -- No --> G["onboarding - Role Selection"]
    G --> F
    D --> H[Google OAuth]
    H --> I{New user?}
    I -- Yes --> J[Email Verification]
    J --> G
    I -- No --> F
```

---

## 2. Auth & Onboarding

```mermaid
flowchart TD
    A[Sign In Page] --> B[Click Sign in with Google]
    B --> C[Google OAuth Consent]
    C -- Denied --> A
    C -- Approved --> D[Supabase Auth Callback]
    D --> E{Account exists?}
    E -- No --> F[Create user record]
    F --> G[Send 6-digit verification email]
    G --> H[Verification Code Entry]
    H -- Wrong code --> H
    H -- Expired --> I[Resend Code]
    I --> H
    H -- Correct --> J[Mark user as verified]
    J --> K[Role Selection Screen]
    K --> L["POST /api/onboarding"]
    L --> M["hub - Feed"]
    E -- Yes --> N{Verified?}
    N -- No --> G
    N -- Yes --> O{Role set?}
    O -- No --> K
    O -- Yes --> M
```

---

## 3. Feed & Posts

```mermaid
flowchart TD
    A["hub - Feed"] --> B["GET /api/feed"]
    B --> C{Cache hit?}
    C -- Yes --> D[Render cached ranked feed]
    C -- No --> E[AI Ranking Pipeline - Groq]
    E --> F{Pipeline success?}
    F -- Yes --> G[Render AI-ranked feed]
    F -- No --> H[Fallback: Chronological feed]
    G --> I[User scrolls - load more posts]
    H --> I

    D --> J{User action}
    G --> J
    H --> J

    J -- Pull to refresh --> K["POST /api/feed/refresh"]
    K --> B

    J -- Create post --> L[Post Composer]
    L --> M{Content type}
    M -- Text --> N["POST /api/posts"]
    M -- With media --> O[Upload media]
    O --> N
    M -- With poll --> P[Add poll options]
    P --> N
    N --> Q[Post appears in feed]
    Q --> R[Notify followers]

    J -- Click post --> S[Post Detail View]
    S --> T["GET /api/posts/postId/replies"]
    T --> U[Show replies thread]
    U --> V[Reply composer]
    V --> W["POST /api/posts/postId/replies"]
    W --> X[Notify post author]
```

---

## 4. User Profile

```mermaid
flowchart TD
    A["Navigate to /profile/username"] --> B["GET /api/users/username/profile"]
    B --> C{Is own profile?}

    C -- Yes --> D[Owner View]
    D --> E[Show edit controls]
    D --> F["GET /api/users/profile-completion"]
    F --> G[Show completion %]
    E --> H{Edit section}
    H -- Bio/Avatar/Role --> I[Update profile]
    H -- Education --> J["Add/Edit/Delete education"]
    H -- Work Experience --> K[Add/Edit/Delete work exp]
    H -- Portfolio --> L[Add/Edit/Delete portfolio]
    H -- Positions --> M[Add/Edit/Delete positions]

    C -- No --> N[Visitor View]
    N --> O{Is following?}
    O -- Yes --> P[Show Unfollow button]
    O -- No --> Q[Show Follow button]
    Q --> R["POST /api/users/username/follow"]
    R --> S[Notify followed user]
    P --> T["POST /api/users/username/follow - toggle off"]

    N --> U[View sections]
    U --> V["Education / Work / Portfolio / Projects"]
    U --> W[Followers tab]
    U --> X[Following tab]
    W --> Y["GET /api/users/username/followers"]
    X --> Z["GET /api/users/username/following"]
```

---

## 5. Messaging

```mermaid
flowchart TD
    A["messages"] --> B["GET /api/conversations"]
    B --> C[Conversation list]
    C --> D{Action}

    D -- Click conversation --> E["GET /api/conversations/conversationId"]
    E --> F["GET /api/messages?conversation_id=X"]
    F --> G[Render message thread]
    G --> H{User action}
    H -- Scroll up --> I[Load older messages - cursor pagination]
    I --> G
    H -- "Type and send" --> J["POST /api/messages"]
    J --> K[Message appears - optimistic UI]
    K --> L[Push notification to recipient]
    H -- Long press message --> M[Emoji reaction picker]
    M --> N["POST /api/messages/reactions"]
    N --> O[Reaction shown on message]
    H -- Remove reaction --> P["DELETE /api/messages/reactions"]

    G --> Q["POST /api/messages/read - on open"]

    D -- New conversation --> R[Search for user]
    R --> S["GET /api/users/search"]
    S --> T[Select user]
    T --> U["POST /api/conversations"]
    U --> E
```

---

## 6. Startups

```mermaid
flowchart TD
    A["startups"] --> B["GET /api/startups"]
    B --> C[Startup directory - filtered and cached]
    C --> D{Action}

    D -- Browse --> E[Filter by category/stage/location]
    E --> B

    D -- Click startup --> F["GET /api/startups/id"]
    F --> G[Startup profile page]
    G --> H["POST /api/startups/id/view - track"]
    G --> I{User action}
    I -- Bookmark --> J["POST /api/startups/id/bookmark"]
    I -- "Owner/Cofounder: Edit" --> K["POST /api/startups/id"]

    D -- Create startup --> L[Startup creation form]
    L --> M["POST /api/startups"]
    M --> N[Redirect to new startup profile]

    G --> O[Founders section]
    O --> P{Is owner?}
    P -- Yes --> Q[Invite co-founder]
    Q --> R{Invite by?}
    R -- Ments username --> S["POST /api/startups/id/founders - username"]
    R -- Email --> T["POST /api/startups/id/founders - email"]
    S --> U[Status: pending - hidden from public]
    T --> U
    U --> V[Notify invitee]

    V --> W[Invitee sees invitation]
    W --> X{Response}
    X -- Accept --> Y["POST /api/startups/founders/respond - accepted"]
    X -- Decline --> Z["POST /api/startups/founders/respond - declined"]
    Y --> AA[Cofounder shown on public profile]

    P -- Yes --> AB[Add funding round]
    AB --> AC["POST /api/startups/id/funding"]
```

---

## 7. Discovery and Search

```mermaid
flowchart TD
    A[Search bar - anywhere in app] --> B{Input type}
    B -- Type query --> C["GET /api/search?q=X"]
    C --> D["Results: People / Posts / Startups"]
    D --> E{Click result}
    E -- Person --> F[Profile page]
    E -- Post --> G[Post detail]
    E -- Startup --> H[Startup profile]

    B -- "Empty/focus" --> I["GET /api/trending"]
    I --> J[Trending topics shown]
    J --> K[Click topic]
    K --> L[Filtered feed view]

    A --> M[Recommendations page]
    M --> N["GET /api/recommendations"]
    N --> O["Suggested: users, startups, content"]
    O --> P{Action}
    P -- Follow user --> Q["POST /api/users/username/follow"]
    P -- View startup --> H
    P -- Dismiss --> R[Remove from recommendations]

    M --> S["GET /api/resources/recommendations"]
    S --> T[Curated resources for user role]
```

---

## 8. Events

```mermaid
flowchart TD
    A["events"] --> B["GET /api/events"]
    B --> C[Events directory]
    C --> D{Action}

    D -- Filter --> E[By category/date/location]
    E --> B

    D -- Click event --> F["GET /api/events/id"]
    F --> G[Event detail page]
    G --> H{Already joined?}
    H -- No --> I[Join button]
    I --> J["POST /api/events/id/join"]
    J --> K[Confirmation notification]
    J --> L["Event in user's joined list"]
    H -- Yes --> M[Show Joined status]

    D -- Create event --> N[Event creation form]
    N --> O["POST /api/events"]
    O --> C
```

---

## 9. Competitions

```mermaid
flowchart TD
    A["competitions"] --> B["GET /api/competitions"]
    B --> C[Competitions directory]
    C --> D{Action}

    D -- Click competition --> E["GET /api/competitions/id"]
    E --> F[Competition detail]
    F --> G{Deadline passed?}
    G -- Yes --> H[Show Closed - no join]
    G -- No --> I[Join button]
    I --> J["POST /api/competitions/id/join"]
    J --> K[Confirmation and submission instructions]

    F --> L[View entries]
    L --> M["GET /api/competitions/id/entries"]

    D -- Create competition --> N[Competition form]
    N --> O["POST /api/competitions"]
    O --> C
```

---

## 10. Gigs and Jobs

```mermaid
flowchart TD
    A["gigs or jobs"] --> B{Section}

    B -- Gigs --> C["GET /api/gigs"]
    C --> D[Gig listings]
    D --> E["GET /api/gigs/id"]
    E --> F[Gig detail - apply/contact]

    B -- Jobs --> G["GET /api/jobs"]
    G --> H[Job listings]
    H --> I["GET /api/jobs/id"]
    I --> J[Job detail - apply link]

    B -- Post gig --> K[Gig form]
    K --> L["POST /api/gigs"]

    B -- Post job --> M[Job form]
    M --> N["POST /api/jobs"]
    N --> G
    L --> C
```

---

## 11. Applications

```mermaid
flowchart TD
    A[Program detail page] --> B["GET /api/applications/check"]
    B --> C{Existing application?}

    C -- "Yes, Draft" --> D[Continue Application button]
    C -- "Yes, Submitted" --> E[Show application status]
    C -- No --> F[Apply button]

    F --> G["POST /api/applications/start"]
    G --> H[Application form]
    H --> I[Answer questions one by one]
    I --> J["POST /api/applications/id/answer - auto-save"]
    J --> K{All required answered?}
    K -- No --> I
    K -- Yes --> L[Submit button enabled]
    L --> M["POST /api/applications/id/submit"]
    M --> N[Status: Submitted]
    N --> O[Confirmation notification]

    D --> H

    E --> P{Status}
    P -- Under Review --> Q[Show review state]
    P -- Accepted --> R[Show next steps]
    P -- Rejected --> S[Show rejection message]

    R --> T[Notification on status change]
    S --> T
```

---

## 12. Notifications

```mermaid
flowchart TD
    A[Any user action triggers notification] --> B{Notification type}

    B -- Reply to post --> C["POST /api/push-on-reply"]
    B -- Mention --> D["POST /api/push-on-mention"]
    B -- Follow --> E[In-app notification]
    B -- Co-founder invite --> F[In-app and email notification]
    B -- App status change --> G[In-app notification]
    B -- Event reminder --> H[Push notification]

    C --> I[Push delivered to device]
    D --> I
    H --> I
    E --> J[In-app bell badge increments]
    F --> J
    G --> J

    I --> K[User taps push]
    K --> L[Open relevant content in app]

    J --> M[User clicks bell icon]
    M --> N["POST /api/notifications"]
    N --> O[Notification panel opens]
    O --> P[Click notification]
    P --> L
```
