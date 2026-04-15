import { invokeCommand } from '$lib/backend/commandClient';
import type { BuildStatus, NovelProject, SavedProjectLibraryEntry, StoryPackage } from '$lib/types';

export const createProject = (name: string): Promise<NovelProject> =>
  invokeCommand('create_project', { name });

export const listProjects = (): Promise<NovelProject[]> =>
  invokeCommand('list_projects', {});

export const listSavedProjects = (): Promise<SavedProjectLibraryEntry[]> =>
  invokeCommand('list_saved_projects', {});

export const importNovelText = (projectId: string, content: string): Promise<NovelProject> =>
  invokeCommand('import_novel_text', { projectId, content });

export const buildStoryPackage = (projectId: string): Promise<BuildStatus> =>
  invokeCommand('build_story_package', { projectId });

export const getBuildStatus = (projectId: string): Promise<BuildStatus> =>
  invokeCommand('get_build_status', { projectId });

export const loadStoryPackage = (projectId: string): Promise<StoryPackage> =>
  invokeCommand('load_story_package', { projectId });

export const getProject = (projectId: string): Promise<NovelProject> =>
  invokeCommand('get_project', { projectId });
