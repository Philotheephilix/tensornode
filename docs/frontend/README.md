# Frontend Application

The TensorNode frontend is a modern Next.js 15 application built with React 19, TypeScript, and Tailwind CSS. It provides an intuitive interface for miners, validators, and network administrators to interact with the decentralized AI network.

## Architecture Overview

The frontend follows a modular architecture with clear separation of concerns:

```
src/
├── app/                    # App Router (Next.js 13+)
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   ├── globals.css        # Global styles
│   ├── miner/             # Miner interface
│   │   └── page.tsx
│   ├── validator/         # Validator interface
│   │   └── page.tsx
│   ├── subnet/            # Subnet management
│   │   └── page.tsx
│   └── api/               # API routes
│       ├── agent/
│       ├── instance-registry/
│       ├── token/
│       ├── topic/
│       └── wallet/
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   ├── Chat.tsx          # Chat interface
│   ├── WalletConnect.tsx # Wallet integration
│   └── ...
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
├── types/                # TypeScript definitions
└── styles/               # Additional styles
```

## Key Features

### 1. Multi-Role Interface
- **Miner Dashboard**: VM management, deployment, monitoring
- **Validator Interface**: Query submission, response scoring
- **Subnet Management**: Network overview, node types

### 2. Wallet Integration
- Hedera wallet connectivity (HashPack, Blade, etc.)
- WalletConnect v2 support
- Transaction signing and account management

### 3. Real-time Updates
- WebSocket connections for live data
- Real-time VM status updates
- Live validation scoring

### 4. Responsive Design
- Mobile-first approach
- Adaptive layouts for all screen sizes
- Touch-friendly interactions

## Technology Stack

### Core Technologies
- **Next.js 15**: React framework with App Router
- **React 19**: Latest React with concurrent features
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework

### UI Components
- **shadcn/ui**: High-quality component library
- **Radix UI**: Accessible component primitives
- **Lucide React**: Beautiful icon library
- **Sonner**: Toast notifications

### State Management
- **React Context**: Global state management
- **Custom Hooks**: Reusable stateful logic
- **Local Storage**: Persistent client state

### Blockchain Integration
- **Hedera SDK**: Blockchain interactions
- **WalletConnect**: Wallet connectivity
- **Hedera Agent Kit**: AI agent integration

## Pages and Routes

### Home Page (`/`)
The landing page provides an overview of TensorNode and quick access to main features:

```tsx
export default function Home() {
  return (
    <>
      <Hero />
      <section className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardHeader>
              <CardTitle>Subnet</CardTitle>
              <CardDescription>Manage nodes and view VM instances.</CardDescription>
              <Link href="/subnet">
                <Button size="sm">Open Subnet</Button>
              </Link>
            </CardHeader>
          </Card>
          {/* Miner and Validator cards */}
        </div>
      </section>
    </>
  );
}
```

### Miner Page (`/miner`)
Comprehensive miner management interface:

**Key Features:**
- VM instance listing and management
- Docker deployment (upload/URL)
- Performance monitoring
- Earnings tracking

**State Management:**
```tsx
const [vms, setVms] = useState<Vm[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [accountId, setAccountId] = useState<string | null>(null);
```

### Validator Page (`/validator`)
Interface for network validation:

**Key Features:**
- Query submission with expected answers
- Real-time scoring results
- Active miner discovery
- Subnet selection

### Subnet Page (`/subnet`)
Network management and overview:

**Key Features:**
- Node type selection (LLM, Vision, etc.)
- VM allocation and management
- Network statistics

## Component Architecture

### Core Components

#### WalletConnect Component
Handles Hedera wallet integration:

```tsx
export default function WalletConnect({ variant = "default" }: WalletConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  
  const connectWallet = async () => {
    try {
      await ensureWalletConnector("warn");
      const account = await getPairedAccountId();
      setAccountId(account);
      setIsConnected(true);
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };
  
  return (
    <Button onClick={connectWallet} variant={variant}>
      {isConnected ? `Connected: ${accountId}` : "Connect Wallet"}
    </Button>
  );
}
```

#### Chat Component
AI agent interaction interface:

```tsx
export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const sendMessage = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, messages })
      });
      
      const result = await response.json();
      setMessages(prev => [...prev, 
        { role: 'user', content: input },
        { role: 'assistant', content: result.result.response }
      ]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="chat-container">
      <MessageList messages={messages} />
      <MessageInput 
        value={input} 
        onChange={setInput}
        onSend={sendMessage}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### UI Components

The application uses shadcn/ui components for consistent design:

```tsx
// Example usage of UI components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
```

## Custom Hooks

### useWalletConnect
Manages wallet connection state:

```tsx
export function useWalletConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const connect = useCallback(async () => {
    try {
      await ensureWalletConnector("warn");
      const account = await getPairedAccountId();
      setAccountId(account);
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, []);
  
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAccountId(null);
  }, []);
  
  return { isConnected, accountId, error, connect, disconnect };
}
```

### useAutoSign
Handles automatic transaction signing:

```tsx
export function useAutoSign() {
  const [isEnabled, setIsEnabled] = useState(false);
  
  const signTransaction = useCallback(async (transactionBytes: string) => {
    if (!isEnabled) return null;
    
    try {
      // Auto-sign logic here
      return await walletConnector.signTransaction(transactionBytes);
    } catch (error) {
      console.error("Auto-sign failed:", error);
      return null;
    }
  }, [isEnabled]);
  
  return { isEnabled, setIsEnabled, signTransaction };
}
```

### useMessageSubmit
Manages message submission to the network:

```tsx
export function useMessageSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const submitMessage = useCallback(async (message: string, topicId: string) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/topic/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, message })
      });
      
      if (!response.ok) {
        throw new Error(`Submit failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);
  
  return { submitMessage, isSubmitting, error };
}
```

## API Integration

### Client-Side API Calls

The frontend makes API calls to both internal Next.js API routes and the external backend:

```tsx
// Internal API routes
const agentResponse = await fetch('/api/agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: userMessage })
});

// External backend API
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
const vmList = await fetch(`${backendUrl}/vms`);
```

### Error Handling

Consistent error handling across the application:

```tsx
const handleApiError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  
  toast({
    title: "Action failed",
    description: (
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <span>{message}</span>
      </div>
    ),
    className: "rounded-2xl border border-primary bg-background/80 backdrop-blur-sm"
  });
};
```

## Styling and Theming

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### CSS Variables

```css
/* globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --border: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
}
```

## Performance Optimization

### Code Splitting

Next.js automatically splits code, but you can optimize further:

```tsx
import dynamic from 'next/dynamic';

// Lazy load heavy components
const Chat = dynamic(() => import('@/components/Chat'), {
  loading: () => <div>Loading chat...</div>,
  ssr: false
});

const ParticleBackground = dynamic(() => import('@/components/gl/particles'), {
  ssr: false
});
```

### Image Optimization

```tsx
import Image from 'next/image';

export function Logo() {
  return (
    <Image
      src="/logo.png"
      alt="TensorNode"
      width={120}
      height={40}
      priority
      className="h-auto w-auto"
    />
  );
}
```

### Caching Strategies

```tsx
// API route with caching
export async function GET() {
  const data = await fetchExpensiveData();
  
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
    }
  });
}
```

## Testing

### Component Testing

```tsx
// __tests__/components/WalletConnect.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import WalletConnect from '@/components/WalletConnect';

describe('WalletConnect', () => {
  it('renders connect button when not connected', () => {
    render(<WalletConnect />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });
  
  it('handles connection click', async () => {
    render(<WalletConnect />);
    fireEvent.click(screen.getByText('Connect Wallet'));
    // Test connection logic
  });
});
```

### API Route Testing

```tsx
// __tests__/api/agent.test.ts
import { POST } from '@/app/api/agent/route';
import { NextRequest } from 'next/server';

describe('/api/agent', () => {
  it('processes agent requests', async () => {
    const request = new NextRequest('http://localhost:3000/api/agent', {
      method: 'POST',
      body: JSON.stringify({ input: 'test message' })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('result');
  });
});
```

## Deployment

### Build Configuration

```javascript
// next.config.ts
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@hashgraph/sdk']
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.BACKEND_URL}/:path*`
      }
    ];
  }
};

export default nextConfig;
```

### Docker Configuration

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

### Environment Setup

```env
# .env.local
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
HEDERA_OPERATOR_ID=0.0.your_account_id
HEDERA_OPERATOR_KEY=your_private_key
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
```

### Code Quality

```json
// .eslintrc.json
{
  "extends": ["next/core-web-vitals", "@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/exhaustive-deps": "error"
  }
}
```

---

The TensorNode frontend provides a comprehensive, user-friendly interface for interacting with the decentralized AI network. Its modular architecture, modern technology stack, and focus on user experience make it easy to use while maintaining the flexibility needed for a complex distributed system.
