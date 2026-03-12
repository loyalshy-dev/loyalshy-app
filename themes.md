

# Whatsapp Theme
```css
:root {
  --background: #f0f2f5;
  --foreground: #111b21;
  --card: #ffffff;
  --card-foreground: #111b21;
  --popover: #ffffff;
  --popover-foreground: #111b21;
  --primary: #075e54;
  --primary-foreground: #ffffff;
  --secondary: #e7f8f0;
  --secondary-foreground: #075e54;
  --muted: #f0f2f5;
  --muted-foreground: #667781;
  --accent: #25d366;
  --accent-foreground: #ffffff;
  --destructive: #ea4335;
  --destructive-foreground: #ffffff;
  --border: #e9edef;
  --input: #e9edef;
  --ring: #25d366;
  --chart-1: #25d366;
  --chart-2: #075e54;
  --chart-3: #128c7e;
  --chart-4: #34b7f1;
  --chart-5: #00a884;
  --sidebar: #ffffff;
  --sidebar-foreground: #111b21;
  --sidebar-primary: #075e54;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #e7f8f0;
  --sidebar-accent-foreground: #075e54;
  --sidebar-border: #e9edef;
  --sidebar-ring: #25d366;
  --font-sans: Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, Ubuntu, Cantarell, Fira Sans, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  --radius: 1rem;
  --shadow-x: 0px;
  --shadow-y: 2px;
  --shadow-blur: 10px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.1;
  --shadow-color: rgba(0,0,0,0.1);
  --shadow-2xs: 0px 2px 10px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0px 2px 10px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0px 2px 10px 0px hsl(0 0% 0% / 0.10), 0px 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow: 0px 2px 10px 0px hsl(0 0% 0% / 0.10), 0px 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow-md: 0px 2px 10px 0px hsl(0 0% 0% / 0.10), 0px 2px 4px -1px hsl(0 0% 0% / 0.10);
  --shadow-lg: 0px 2px 10px 0px hsl(0 0% 0% / 0.10), 0px 4px 6px -1px hsl(0 0% 0% / 0.10);
  --shadow-xl: 0px 2px 10px 0px hsl(0 0% 0% / 0.10), 0px 8px 10px -1px hsl(0 0% 0% / 0.10);
  --shadow-2xl: 0px 2px 10px 0px hsl(0 0% 0% / 0.25);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

.dark {
  --background: #0b141a;
  --foreground: #e9edef;
  --card: #1f2c34;
  --card-foreground: #e9edef;
  --popover: #1f2c34;
  --popover-foreground: #e9edef;
  --primary: #00a884;
  --primary-foreground: #111b21;
  --secondary: #12332a;
  --secondary-foreground: #00a884;
  --muted: #182229;
  --muted-foreground: #8696a0;
  --accent: #25d366;
  --accent-foreground: #111b21;
  --destructive: #ea4335;
  --destructive-foreground: #e9edef;
  --border: #2a3942;
  --input: #2a3942;
  --ring: #00a884;
  --chart-1: #25d366;
  --chart-2: #00a884;
  --chart-3: #128c7e;
  --chart-4: #34b7f1;
  --chart-5: #075e54;
  --sidebar: #111b21;
  --sidebar-foreground: #e9edef;
  --sidebar-primary: #00a884;
  --sidebar-primary-foreground: #111b21;
  --sidebar-accent: #12332a;
  --sidebar-accent-foreground: #00a884;
  --sidebar-border: #2a3942;
  --sidebar-ring: #00a884;
  --font-sans: Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, Ubuntu, Cantarell, Fira Sans, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  --radius: 1rem;
  --shadow-x: 0px;
  --shadow-y: 4px;
  --shadow-blur: 12px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.4;
  --shadow-color: rgba(0,0,0,0.4);
  --shadow-2xs: 0px 4px 12px 0px hsl(0 0% 0% / 0.20);
  --shadow-xs: 0px 4px 12px 0px hsl(0 0% 0% / 0.20);
  --shadow-sm: 0px 4px 12px 0px hsl(0 0% 0% / 0.40), 0px 1px 2px -1px hsl(0 0% 0% / 0.40);
  --shadow: 0px 4px 12px 0px hsl(0 0% 0% / 0.40), 0px 1px 2px -1px hsl(0 0% 0% / 0.40);
  --shadow-md: 0px 4px 12px 0px hsl(0 0% 0% / 0.40), 0px 2px 4px -1px hsl(0 0% 0% / 0.40);
  --shadow-lg: 0px 4px 12px 0px hsl(0 0% 0% / 0.40), 0px 4px 6px -1px hsl(0 0% 0% / 0.40);
  --shadow-xl: 0px 4px 12px 0px hsl(0 0% 0% / 0.40), 0px 8px 10px -1px hsl(0 0% 0% / 0.40);
  --shadow-2xl: 0px 4px 12px 0px hsl(0 0% 0% / 1.00);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}
```

# Meh

```css
:root {
  --background: #f6f5f4;
  --foreground: #161614;
  --card: #ffffff;
  --card-foreground: #161614;
  --popover: #ffffff;
  --popover-foreground: #161614;
  --primary: #d10001;
  --primary-foreground: #f6f5f4;
  --secondary: #434340;
  --secondary-foreground: #f6f5f4;
  --muted: #f4f1ef;
  --muted-foreground: #a8a5a1;
  --accent: #f4f1ef;
  --accent-foreground: #2b2b27;
  --destructive: #ffd5c0;
  --destructive-foreground: #eb001f;
  --border: #e9e5e0;
  --input: #c9c6c1;
  --ring: #776beb;
  --chart-1: #b43310;
  --chart-2: #00b59b;
  --chart-3: #719d68;
  --chart-4: #ffb900;
  --chart-5: #fe9a00;
  --sidebar: #ffffff;
  --sidebar-foreground: #161614;
  --sidebar-primary: #2b2b27;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f4f1ef;
  --sidebar-accent-foreground: #2b2b27;
  --sidebar-border: #e9e5e0;
  --sidebar-ring: #2b7fff;
  --font-sans: Inter, system-ui, sans-serif;
  --font-serif: Inter, ui-sans-serif, sans-serif, system-ui;
  --font-mono: JetBrains Mono, monospace;
  --radius: 0rem;
  --shadow-x: 0px;
  --shadow-y: 2px;
  --shadow-blur: 4px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.1;
  --shadow-color: #000000;
  --shadow-2xs: 0px 2px 4px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0px 2px 4px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0px 2px 4px 0px hsl(0 0% 0% / 0.10), 0px 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow: 0px 2px 4px 0px hsl(0 0% 0% / 0.10), 0px 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow-md: 0px 2px 4px 0px hsl(0 0% 0% / 0.10), 0px 2px 4px -1px hsl(0 0% 0% / 0.10);
  --shadow-lg: 0px 2px 4px 0px hsl(0 0% 0% / 0.10), 0px 4px 6px -1px hsl(0 0% 0% / 0.10);
  --shadow-xl: 0px 2px 4px 0px hsl(0 0% 0% / 0.10), 0px 8px 10px -1px hsl(0 0% 0% / 0.10);
  --shadow-2xl: 0px 2px 4px 0px hsl(0 0% 0% / 0.25);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

.dark {
  --background: #1d1d1d;
  --foreground: #ffffff;
  --card: #1d1d1d;
  --card-foreground: #ffffff;
  --popover: #1d1d1d;
  --popover-foreground: #ffffff;
  --primary: #ff4b32;
  --primary-foreground: #ffffff;
  --secondary: #808080;
  --secondary-foreground: #ffffff;
  --muted: #333333;
  --muted-foreground: #808080;
  --accent: #404040;
  --accent-foreground: #ffffff;
  --destructive: #d00000;
  --destructive-foreground: #ffffff;
  --border: #333333;
  --input: #1d1d1d;
  --ring: #ff4b32;
  --chart-1: #ff4b32;
  --chart-2: #808080;
  --chart-3: #545454;
  --chart-4: #d00000;
  --chart-5: #ffffff;
  --sidebar: #1d1d1d;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #ff4b32;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #404040;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: #333333;
  --sidebar-ring: #ff4b32;
  --font-sans: Inter, system-ui, sans-serif;
  --font-serif: Inter, ui-sans-serif, sans-serif, system-ui;
  --font-mono: JetBrains Mono, monospace;
  --radius: 0rem;
  --shadow-x: 0px;
  --shadow-y: 4px;
  --shadow-blur: 8px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.5;
  --shadow-color: #000000;
  --shadow-2xs: 0px 4px 8px 0px hsl(0 0% 0% / 0.25);
  --shadow-xs: 0px 4px 8px 0px hsl(0 0% 0% / 0.25);
  --shadow-sm: 0px 4px 8px 0px hsl(0 0% 0% / 0.50), 0px 1px 2px -1px hsl(0 0% 0% / 0.50);
  --shadow: 0px 4px 8px 0px hsl(0 0% 0% / 0.50), 0px 1px 2px -1px hsl(0 0% 0% / 0.50);
  --shadow-md: 0px 4px 8px 0px hsl(0 0% 0% / 0.50), 0px 2px 4px -1px hsl(0 0% 0% / 0.50);
  --shadow-lg: 0px 4px 8px 0px hsl(0 0% 0% / 0.50), 0px 4px 6px -1px hsl(0 0% 0% / 0.50);
  --shadow-xl: 0px 4px 8px 0px hsl(0 0% 0% / 0.50), 0px 8px 10px -1px hsl(0 0% 0% / 0.50);
  --shadow-2xl: 0px 4px 8px 0px hsl(0 0% 0% / 1.25);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}

```



# Top 

```css
:root {
  --background: #fdfdfd;
  --foreground: #000000;
  --card: #fdfdfd;
  --card-foreground: #000000;
  --popover: #fcfcfc;
  --popover-foreground: #000000;
  --primary: #c92d6a;
  --primary-foreground: #ffffff;
  --secondary: #1b1d1e;
  --secondary-foreground: #edf0f4;
  --muted: #f5f5f5;
  --muted-foreground: #525252;
  --accent: #fbdae7;
  --accent-foreground: #c92d6a;
  --destructive: #e54b4f;
  --destructive-foreground: #ffffff;
  --border: #e7e7ee;
  --input: #ebebeb;
  --ring: #000000;
  --chart-1: #4ac885;
  --chart-2: #c92d6a;
  --chart-3: #fd822b;
  --chart-4: #a146fb;
  --chart-5: #747474;
  --sidebar: #f5f8fb;
  --sidebar-foreground: #000000;
  --sidebar-primary: #000000;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #ebebeb;
  --sidebar-accent-foreground: #000000;
  --sidebar-border: #ebebeb;
  --sidebar-ring: #000000;
  --font-sans: var(--font-montserrat), Montserrat, sans-serif;
  --font-serif: Lora, serif;
  --font-mono: IBM Plex Mono, monospace;
  --radius: 1.4rem;
  --shadow-x: 0;
  --shadow-y: 1px;
  --shadow-blur: 3px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.1;
  --shadow-color: #000000;
  --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow-md: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10);
  --shadow-lg: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10);
  --shadow-xl: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10);
  --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);
  --tracking-normal: 0em;
  --spacing: 0.27rem;
}

.dark {
  --background: #060606;
  --foreground: #f0f0f0;
  --card: #18191b;
  --card-foreground: #f0f0f0;
  --popover: #222327;
  --popover-foreground: #f0f0f0;
  --primary: #c92d6a;
  --primary-foreground: #ffffff;
  --secondary: #1b1d1e;
  --secondary-foreground: #f0f0f0;
  --muted: #2a2c33;
  --muted-foreground: #a0a0a0;
  --accent: #1e293b;
  --accent-foreground: #c92d6a;
  --destructive: #f87171;
  --destructive-foreground: #ffffff;
  --border: #33353a;
  --input: #33353a;
  --ring: #c92d6a;
  --chart-1: #4ade80;
  --chart-2: #c92d6a;
  --chart-3: #fca5a5;
  --chart-4: #5993f4;
  --chart-5: #a0a0a0;
  --sidebar: #161618;
  --sidebar-foreground: #f0f0f0;
  --sidebar-primary: #c92d6a;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #2a2c33;
  --sidebar-accent-foreground: #ff5ce1;
  --sidebar-border: #33353a;
  --sidebar-ring: #ff5ce1;
  --font-sans: var(--font-montserrat), Montserrat, sans-serif;
  --font-serif: Lora, serif;
  --font-mono: IBM Plex Mono, monospace;
  --radius: 1.4rem;
  --shadow-x: 0;
  --shadow-y: 1px;
  --shadow-blur: 3px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.1;
  --shadow-color: #000000;
  --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow-md: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10);
  --shadow-lg: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10);
  --shadow-xl: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10);
  --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}
```