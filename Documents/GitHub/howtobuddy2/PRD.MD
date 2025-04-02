# HowToBuddy - Product Requirements Document

## Overview
HowToBuddy is a web application that transforms YouTube tutorials into structured learning materials. It helps users learn more effectively by converting video content into organized, written documentation with step-by-step instructions, code snippets, and key concepts.

## Core Features

### 1. YouTube Video Processing
- Accept YouTube video URLs
- Extract video content and transcripts
- Process and structure the content into learning materials

### 2. Content Generation
- Generate structured documentation from video content
- Extract code snippets and examples
- Identify key concepts and learning objectives
- Create step-by-step instructions

### 3. User Dashboard
- View all processed tutorials
- Track processing status
- Manage credits and usage
- Access generated content

### 4. Authentication
- Social login (GitHub, Google)
- Email/password authentication
- User profile management

## Technical Requirements

### Frontend
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Shadcn UI Components
- Responsive design

### Backend
- Next.js API Routes
- OpenAI API integration
- YouTube Data API integration
- Database (Supabase)

### Authentication
- NextAuth.js
- Social providers
- JWT tokens

### Data Storage
- PostgreSQL (via Supabase)
- Store user data
- Store processed tutorials
- Cache generated content

## User Flow
1. User signs up/logs in
2. User submits YouTube URL
3. System processes video
4. System generates documentation
5. User accesses structured content 