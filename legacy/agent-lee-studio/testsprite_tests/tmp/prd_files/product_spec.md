# Agent Lee Studio - Product Requirements Document

## Overview
**Agent Lee Studio** is an AI-powered creation engine featuring an interactive 3D voxel visualization and code assistant interface. The application provides a Google AI Studio-like experience with a reactive neural core that responds to voice commands and user input.

## Core Features

### 1. Interactive 3D Voxel Core (Agent Lee)
- **Real-time 3D visualization** using Three.js with 15,000 voxel particles
- **Mood system** with visual states: neutral (cyan), angry (red), happy (green), thinking (purple)
- **Audio reactivity** - responds to microphone input with particle animations
- **Bloom effects** and dynamic lighting for premium visual experience
- **OrbitControls** for user interaction and auto-rotation

### 2. Code Assistant Chat Interface
- **Real-time chat** with AI assistant for code generation and commands
- **System commands** for controlling the voxel core:
  - Mood changes: "Make him angry", "Stabilize to blue", "Make him happy"
  - Text-to-speech: "Say [text]", "Speak [phrase]"
  - Density control: "Make smaller", "Dense mode"
  - Microphone toggle for voice interaction
- **Message history** with user and AI avatars
- **Responsive input** with keyboard shortcuts (Enter to send)

### 3. File Explorer
- **Project structure viewer** with collapsible folders
- **Syntax highlighting** icons for different file types (.tsx, .json, .yml, etc.)
- **Component hierarchy** displaying:
  - Commerce, Gallery, LegalModal, Marketplace
  - ParticleEffect, Presentation, Projects components

### 4. Application Controls
- **Preview/Code toggle** for switching between modes
- **GitHub integration** button
- **Download** functionality
- **Share** capability
- **Settings** configuration

## Technical Stack
- **Frontend**: React 19 with TypeScript
- **3D Engine**: Three.js with post-processing effects
- **Build Tool**: Vite 6
- **UI Icons**: Lucide React
- **Voice**: Web Speech API for text-to-speech

## User Workflows

### Primary Use Case: Interactive AI Development
1. User opens the application to see the 3D voxel core
2. User interacts via chat to create or modify code
3. Agent Lee responds with visual feedback (color/mood changes)
4. User can explore project files in the sidebar
5. User can toggle between preview and code views

### Voice Interaction
1. User clicks microphone button to enable voice input
2. Agent Lee's core reacts to audio levels with particle animations
3. User can command the AI to speak responses aloud
4. Visual indicators show when microphone is active (red highlight)

## Success Criteria
- ✅ 3D visualization loads and animates smoothly (60 FPS target)
- ✅ Chat interface responds to user commands within 500ms
- ✅ File explorer displays full project structure
- ✅ Mood changes are visually distinct and smooth (color transitions)
- ✅ Microphone input creates reactive particle effects
- ✅ Text-to-speech works with natural-sounding voice
- ✅ Responsive layout adapts to different screen sizes

## Known Behaviors
- No authentication required (open access)
- Simulated AI responses (predefined command triggers)
- File explorer is view-only (no file editing in UI)
- Requires Gemini API key in environment variables (.env.local)
- Default port: 3000 (configured in Vite)

## Testing Focus Areas
1. **3D Rendering**: Verify voxel core loads and animates
2. **Command Processing**: Test all chat commands (mood, speech, density)
3. **Microphone**: Enable/disable audio input and verify particle reactivity
4. **UI Navigation**: Test file explorer expansion/collapse
5. **Responsive Design**: Verify mobile/desktop layouts
6. **Performance**: Ensure smooth 60 FPS rendering under load
