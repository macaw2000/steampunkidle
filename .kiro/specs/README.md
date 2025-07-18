# Steampunk Idle Game - Specifications

This directory contains the specifications for the Steampunk Idle Game project.

## Active Specifications

### 🎮 `steampunk-idle-game/`
**Main Game Specification** - This is the primary spec for the entire game including:
- Authentication and character creation
- Core gameplay mechanics (crafting, harvesting, combat)
- Social features (guilds, chat, leaderboards)
- UI/UX enhancements and interfaces
- AWS infrastructure and deployment
- All game features and requirements

**👉 This is your main spec to follow for game development.**

### 🔧 `runtime-fixes/`
**Technical Issues Specification** - Addresses runtime and technical issues:
- Application startup and error handling
- ECS Fargate architecture for idle game mechanics
- Client-server synchronization
- Error boundaries and resilience
- Progress bar implementation

**👉 Use this spec for fixing technical issues and infrastructure.**

## Archived Specifications

The `archive/` folder contains completed or consolidated specifications:
- `ui-enhancements/` - Merged into main steampunk-idle-game spec
- `github-repo-setup/` - Completed one-time setup task
- `test-suite-fixes/` - Completed one-time fix task

## Which Spec Should I Use?

- **For game features, UI, and gameplay**: Use `steampunk-idle-game/`
- **For technical fixes and infrastructure**: Use `runtime-fixes/`
- **For historical reference**: Check `archive/` folder

## Workflow

1. **Feature Development**: Work from `steampunk-idle-game/` tasks
2. **Bug Fixes**: Work from `runtime-fixes/` tasks  
3. **New Features**: Add to `steampunk-idle-game/` requirements
4. **Technical Issues**: Add to `runtime-fixes/` requirements