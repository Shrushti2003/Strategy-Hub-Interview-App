"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Sparkles, LayoutDashboard, Settings, User, FileText, Briefcase } from "lucide-react";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    const openWorkspaceSearch = () => setOpen(true);

    document.addEventListener("keydown", down);
    window.addEventListener("workspace-search:open", openWorkspaceSearch);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("workspace-search:open", openWorkspaceSearch);
    };
  }, []);

  const runCommand = (command) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="AI Actions">
            <CommandItem onSelect={() => runCommand(() => router.push("/dashboard#ai-strategy"))}>
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              <span>Generate Interview Strategy</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/dashboard#ai-strategy"))}>
              <Briefcase className="mr-2 h-4 w-4 text-blue-500" />
              <span>Create Career Roadmap</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/profile"))}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/resume"))}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Resume Builder</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/settings"))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
