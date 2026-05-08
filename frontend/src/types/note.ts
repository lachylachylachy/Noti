export type Category = "Personal" | "Work" | "Projects" | "Study" | "Ideas";

export type Note = {
  id: number;
  title: string;
  content: string;
  category: Category;
  aiEnabled: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export const categories: Category[] = [
  "Personal",
  "Work",
  "Projects",
  "Study",
  "Ideas",
];