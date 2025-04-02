# HowToBuddy

Transform YouTube tutorials into structured learning materials.

## Features

- Process YouTube tutorials into written documentation
- Generate step-by-step instructions
- Extract code snippets and examples
- Create structured learning materials
- Track tutorial progress

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Shadcn UI
- NextAuth.js
- Supabase
- OpenAI API
- YouTube Data API

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/howtobuddy.git
cd howtobuddy
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key

# OpenAI
OPENAI_API_KEY=your-openai-key

# YouTube
YOUTUBE_API_KEY=your-youtube-key
```

## Project Structure

```
src/
  app/              # Next.js app directory
    (auth)/         # Authentication routes
    dashboard/      # Dashboard routes
    api/           # API routes
  components/       # React components
  lib/             # Utility functions
  types/           # TypeScript types
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 