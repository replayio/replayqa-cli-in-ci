"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import {
  Archive,
  ArrowDown,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Flag,
  Folder,
  Inbox,
  ListChecks,
  ListFilter,
  Menu,
  Plus,
  Search,
  Sparkles,
  Star,
  Tag,
  Users,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type SmartListId = "today" | "scheduled" | "all" | "flagged" | "completed"
type ViewId = SmartListId | string
type ListColor = "blue" | "orange" | "teal" | "purple" | "red" | "indigo"
type ListIcon =
  "inbox" | "users" | "shopping" | "briefcase" | "plane" | "folder"
type ReminderPriority = "high" | "medium" | "none"

type ReminderList = {
  id: string
  name: string
  color: ListColor
  icon: ListIcon
}

type Reminder = {
  id: string
  title: string
  notes: string
  listId: string
  dueDate: string
  dueLabel: string
  completed: boolean
  flagged: boolean
  priority: ReminderPriority
  subtasks?: number
}

const smartLists: Array<{
  id: SmartListId
  name: string
  icon: LucideIcon
  tone: string
}> = [
  { id: "today", name: "Today", icon: CalendarDays, tone: "bg-blue-500" },
  { id: "scheduled", name: "Scheduled", icon: Calendar, tone: "bg-red-500" },
  { id: "all", name: "All Reminders", icon: Inbox, tone: "bg-slate-500" },
  { id: "flagged", name: "Flagged", icon: Flag, tone: "bg-yellow-500" },
  {
    id: "completed",
    name: "Completed",
    icon: CheckCircle2,
    tone: "bg-slate-400",
  },
]

const defaultLists: ReminderList[] = [
  { id: "personal", name: "Personal", color: "orange", icon: "users" },
  { id: "groceries", name: "Groceries", color: "teal", icon: "shopping" },
  { id: "work", name: "Work", color: "purple", icon: "briefcase" },
  { id: "travel", name: "Travel", color: "indigo", icon: "plane" },
]

const initialReminders: Reminder[] = [
  {
    id: "reminder-haircut",
    title: "Book a haircut",
    notes: "Try the new place on 5th Street",
    listId: "personal",
    dueDate: "Today",
    dueLabel: "Today · 9:00 AM",
    completed: false,
    flagged: false,
    priority: "medium",
  },
  {
    id: "reminder-budget",
    title: "Review the monthly budget",
    notes: "Look over subscriptions before Friday",
    listId: "work",
    dueDate: "Today",
    dueLabel: "Today · 11:30 AM",
    completed: false,
    flagged: true,
    priority: "high",
    subtasks: 3,
  },
  {
    id: "reminder-groceries",
    title: "Pick up groceries for dinner",
    notes: "Tomatoes, basil, pasta, and sparkling water",
    listId: "groceries",
    dueDate: "Today",
    dueLabel: "Today · 5:30 PM",
    completed: false,
    flagged: false,
    priority: "none",
  },
  {
    id: "reminder-invoice",
    title: "Send invoice to the design team",
    notes: "Attach the final project summary",
    listId: "work",
    dueDate: "Tomorrow",
    dueLabel: "Tomorrow",
    completed: false,
    flagged: true,
    priority: "high",
  },
  {
    id: "reminder-hike",
    title: "Plan the weekend hike",
    notes: "Check the weather and invite Maya",
    listId: "travel",
    dueDate: "Saturday",
    dueLabel: "Sat, Apr 11",
    completed: false,
    flagged: false,
    priority: "none",
  },
  {
    id: "reminder-plants",
    title: "Water the plants",
    notes: "The fiddle leaf needs extra attention",
    listId: "personal",
    dueDate: "No Date",
    dueLabel: "No date",
    completed: false,
    flagged: false,
    priority: "none",
  },
  {
    id: "reminder-passwords",
    title: "Move important passwords to the new vault",
    notes: "",
    listId: "personal",
    dueDate: "Today",
    dueLabel: "Today",
    completed: true,
    flagged: false,
    priority: "none",
  },
]

const subtaskLabels: Record<string, string[]> = {
  "reminder-budget": [
    "Review recurring subscriptions",
    "Compare planned and actual spending",
    "Set next month’s savings target",
  ],
}

const listIconMap: Record<ListIcon, LucideIcon> = {
  inbox: Inbox,
  users: Users,
  shopping: Tag,
  briefcase: Archive,
  plane: Sparkles,
  folder: Folder,
}

const listColorMap: Record<ListColor, string> = {
  blue: "bg-blue-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
  indigo: "bg-indigo-500",
}

const listColorTextMap: Record<ListColor, string> = {
  blue: "text-blue-600",
  orange: "text-orange-600",
  teal: "text-teal-600",
  purple: "text-purple-600",
  red: "text-red-600",
  indigo: "text-indigo-600",
}

const storageKey = "replayqa-reminders-state"

type StoredState = {
  reminders: Reminder[]
  lists: ReminderList[]
}

function parseStoredState(raw: string | null): StoredState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>
    if (Array.isArray(parsed.reminders) && Array.isArray(parsed.lists)) {
      return { reminders: parsed.reminders, lists: parsed.lists }
    }
  } catch {
    // A malformed local copy should never prevent the app from opening.
  }
  return null
}

function useStoredStateSnapshot() {
  const subscribe = React.useCallback((onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => undefined
    window.addEventListener("storage", onStoreChange)
    return () => window.removeEventListener("storage", onStoreChange)
  }, [])
  const getSnapshot = React.useCallback(
    () =>
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(storageKey),
    []
  )
  const getServerSnapshot = React.useCallback(() => null, [])

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function getViewDescription(viewId: ViewId) {
  switch (viewId) {
    case "today":
      return "A clear view of what needs your attention today."
    case "scheduled":
      return "Everything with a date, all in one place."
    case "all":
      return "Every reminder, ready whenever you are."
    case "flagged":
      return "The reminders you marked as important."
    case "completed":
      return "A little proof of everything you have finished."
    default:
      return "Keep the details close and the day moving forward."
  }
}

function isSmartList(id: ViewId): id is SmartListId {
  return smartLists.some((smartList) => smartList.id === id)
}

function matchesView(reminder: Reminder, viewId: ViewId) {
  if (viewId === "completed") return reminder.completed
  if (reminder.completed) return false
  if (viewId === "today") return reminder.dueDate === "Today"
  if (viewId === "scheduled") return reminder.dueDate !== "No Date"
  if (viewId === "all") return true
  if (viewId === "flagged") return reminder.flagged
  return reminder.listId === viewId
}

function groupReminders(reminders: Reminder[]) {
  const groupOrder = ["Today", "Tomorrow", "Saturday", "No Date"]
  const groups = new Map<string, Reminder[]>()

  for (const reminder of reminders) {
    const group = groups.get(reminder.dueDate) ?? []
    group.push(reminder)
    groups.set(reminder.dueDate, group)
  }

  return [...groups.entries()].sort(
    ([groupA], [groupB]) =>
      (groupOrder.indexOf(groupA) === -1 ? 99 : groupOrder.indexOf(groupA)) -
      (groupOrder.indexOf(groupB) === -1 ? 99 : groupOrder.indexOf(groupB))
  )
}

function createListId(name: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
  return `${normalized || "list"}-${Date.now()}`
}

export function RemindersApp() {
  const [selectedView, setSelectedView] = React.useState<ViewId>("today")
  const [query, setQuery] = React.useState("")
  const [expandedReminderIds, setExpandedReminderIds] = React.useState<
    Set<string>
  >(() => new Set())
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const [isNewReminderOpen, setIsNewReminderOpen] = React.useState(false)
  const [isNewListOpen, setIsNewListOpen] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState("")
  const [newNotes, setNewNotes] = React.useState("")
  const [newListId, setNewListId] = React.useState("personal")
  const [newListName, setNewListName] = React.useState("")
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const storedStateRaw = useStoredStateSnapshot()
  const storedState = React.useMemo(
    () => parseStoredState(storedStateRaw),
    [storedStateRaw]
  )
  const [localState, setLocalState] = React.useState<StoredState | null>(null)
  const fallbackState = React.useMemo(
    () => ({ reminders: initialReminders, lists: defaultLists }),
    []
  )
  const state = localState ?? storedState ?? fallbackState
  const { reminders, lists } = state

  React.useEffect(() => {
    if (!localState) return
    window.localStorage.setItem(storageKey, JSON.stringify(localState))
  }, [localState])

  React.useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return
      }
      event.preventDefault()
      searchInputRef.current?.focus()
    }

    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  const selectedList = lists.find((list) => list.id === selectedView)
  const viewTitle = isSmartList(selectedView)
    ? (smartLists.find((smartList) => smartList.id === selectedView)?.name ??
      "Reminders")
    : (selectedList?.name ?? "Reminders")
  const visibleReminders = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return reminders
      .filter((reminder) => matchesView(reminder, selectedView))
      .filter((reminder) => {
        if (!normalizedQuery) return true
        return `${reminder.title} ${reminder.notes}`
          .toLowerCase()
          .includes(normalizedQuery)
      })
  }, [query, reminders, selectedView])
  const groupedReminders = React.useMemo(
    () => groupReminders(visibleReminders),
    [visibleReminders]
  )
  const openCount = reminders.filter((reminder) => !reminder.completed).length

  function chooseView(viewId: ViewId) {
    setSelectedView(viewId)
    setIsSidebarOpen(false)
  }

  function updateState(updater: (current: StoredState) => StoredState) {
    setLocalState((current) => updater(current ?? state))
  }

  function toggleReminder(id: string, completed: boolean) {
    updateState((current) => ({
      ...current,
      reminders: current.reminders.map((reminder) =>
        reminder.id === id ? { ...reminder, completed } : reminder
      ),
    }))
  }

  function toggleFlag(id: string) {
    updateState((current) => ({
      ...current,
      reminders: current.reminders.map((reminder) =>
        reminder.id === id
          ? { ...reminder, flagged: !reminder.flagged }
          : reminder
      ),
    }))
  }

  function toggleSubtasks(id: string) {
    setExpandedReminderIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addReminder(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const title = newTitle.trim()
    if (!title) return

    updateState((current) => ({
      ...current,
      reminders: [
        {
          id: `reminder-${Date.now()}`,
          title,
          notes: newNotes.trim(),
          listId: newListId,
          dueDate: "Today",
          dueLabel: "Today",
          completed: false,
          flagged: false,
          priority: "none",
        },
        ...current.reminders,
      ],
    }))
    setNewTitle("")
    setNewNotes("")
    setSelectedView("today")
    setIsNewReminderOpen(false)
  }

  function addList(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const name = newListName.trim()
    if (!name) return

    const list: ReminderList = {
      id: createListId(name),
      name,
      color: "blue",
      icon: "folder",
    }
    updateState((current) => ({
      ...current,
      lists: [...current.lists, list],
    }))
    setSelectedView(list.id)
    setNewListName("")
    setIsNewListOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#eef0f4] p-3 text-[#1c1c1e] sm:p-6">
      <div
        className="mx-auto flex h-[calc(100vh-1.5rem)] min-h-0 max-w-[1440px] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(30,38,55,0.14)] sm:h-[calc(100vh-3rem)]"
        data-testid="reminders-app"
      >
        <aside
          className={cn(
            "absolute inset-y-3 left-3 z-30 flex min-h-0 w-[286px] flex-col rounded-[24px] border border-black/[0.04] bg-[#f5f5f8]/95 p-4 shadow-xl backdrop-blur-xl transition-transform sm:inset-y-6 sm:left-6 lg:relative lg:inset-0 lg:z-0 lg:translate-x-0 lg:rounded-none lg:border-0 lg:border-r lg:bg-[#f7f7f9] lg:p-5 lg:shadow-none",
            isSidebarOpen
              ? "translate-x-0"
              : "-translate-x-[calc(100%+1rem)] lg:translate-x-0"
          )}
          aria-label="Reminder lists"
        >
          <div className="mb-5 flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#ff9c82] to-[#ff5d77] text-white shadow-sm">
                <Check className="size-4 stroke-[3]" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[13px] font-semibold tracking-[-0.01em]">
                  Reminders
                </p>
                <p className="text-[11px] text-[#8b8d96]">{openCount} to do</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Close reminder lists"
              onPress={() => setIsSidebarOpen(false)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          <nav className="space-y-1" aria-label="Smart lists">
            {smartLists.map((smartList) => {
              const Icon = smartList.icon
              const count = reminders.filter((reminder) => {
                if (smartList.id === "today")
                  return reminder.dueDate === "Today" && !reminder.completed
                if (smartList.id === "scheduled")
                  return reminder.dueDate !== "No Date" && !reminder.completed
                if (smartList.id === "all") return !reminder.completed
                if (smartList.id === "flagged")
                  return reminder.flagged && !reminder.completed
                return reminder.completed
              }).length

              return (
                <Button
                  key={smartList.id}
                  variant="ghost"
                  className={cn(
                    "h-10 w-full justify-start gap-3 rounded-xl px-2.5 text-[13px] text-[#5f626b] hover:bg-white hover:text-[#1c1c1e]",
                    selectedView === smartList.id &&
                      "bg-white font-semibold text-[#1c1c1e] shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                  )}
                  aria-current={
                    selectedView === smartList.id ? "page" : undefined
                  }
                  onPress={() => chooseView(smartList.id)}
                >
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-[7px] text-white",
                      smartList.tone
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-left">{smartList.name}</span>
                  <span className="text-[11px] text-[#a0a1a8] tabular-nums">
                    {count}
                  </span>
                </Button>
              )
            })}
          </nav>

          <Separator className="my-5 bg-black/[0.07]" />

          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[#9a9ba3] uppercase">
              My Lists
            </p>
            <span className="text-[11px] text-[#b0b1b8]">{lists.length}</span>
          </div>
          <nav
            className="min-h-0 flex-1 space-y-1 overflow-y-auto"
            aria-label="My lists"
          >
            {lists.map((list) => {
              const Icon = listIconMap[list.icon]
              const count = reminders.filter(
                (reminder) => reminder.listId === list.id && !reminder.completed
              ).length
              return (
                <Button
                  key={list.id}
                  variant="ghost"
                  className={cn(
                    "h-10 w-full justify-start gap-3 rounded-xl px-2.5 text-[13px] text-[#5f626b] hover:bg-white hover:text-[#1c1c1e]",
                    selectedView === list.id &&
                      "bg-white font-semibold text-[#1c1c1e] shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                  )}
                  aria-current={selectedView === list.id ? "page" : undefined}
                  onPress={() => chooseView(list.id)}
                >
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-[7px] text-white",
                      listColorMap[list.color]
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="flex-1 truncate text-left">{list.name}</span>
                  <span className="text-[11px] text-[#a0a1a8] tabular-nums">
                    {count}
                  </span>
                </Button>
              )
            })}
          </nav>

          <DialogTrigger isOpen={isNewListOpen} onOpenChange={setIsNewListOpen}>
            <Button
              variant="ghost"
              className="mt-3 h-10 w-full justify-start gap-2 rounded-xl px-2.5 text-[13px] text-[#747680] hover:bg-white hover:text-[#1c1c1e]"
              data-testid="new-list-button"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add List
            </Button>
            <Dialog className="max-w-md" data-testid="new-list-dialog">
              <DialogHeader>
                <DialogTitle>New list</DialogTitle>
                <DialogDescription>
                  Make a space for a project, a routine, or anything you want to
                  remember.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={addList}>
                <div className="space-y-2">
                  <Label htmlFor="new-list-name">List name</Label>
                  <Input
                    id="new-list-name"
                    value={newListName}
                    onChange={(event) => setNewListName(event.target.value)}
                    placeholder="e.g. Home projects"
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <DialogClose variant="ghost">Cancel</DialogClose>
                  <Button type="submit" isDisabled={!newListName.trim()}>
                    Create list
                  </Button>
                </DialogFooter>
              </form>
            </Dialog>
          </DialogTrigger>
        </aside>

        {isSidebarOpen && (
          <Button
            variant="ghost"
            className="fixed inset-0 z-20 h-auto rounded-none bg-black/10 lg:hidden"
            aria-label="Dismiss reminder lists"
            onPress={() => setIsSidebarOpen(false)}
          />
        )}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#ededf0] px-5 py-4 sm:px-8 sm:py-5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open reminder lists"
              onPress={() => setIsSidebarOpen(true)}
            >
              <Menu aria-hidden="true" />
            </Button>
            <div className="relative max-w-[360px] min-w-0 flex-1 sm:ml-auto sm:flex-none">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#a6a7ad]"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="h-9 rounded-[11px] border-transparent bg-[#f3f3f6] pl-9 text-[13px] shadow-none placeholder:text-[#a6a7ad] focus-visible:border-[#d7d7dc] focus-visible:bg-white focus-visible:ring-0"
                aria-label="Search reminders"
                data-testid="search-reminders"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="hidden text-[#8f9098] sm:inline-flex"
              aria-label="Filter reminders"
            >
              <ListFilter aria-hidden="true" />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-10 sm:py-12">
              <div className="mb-9 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="mb-2 text-[12px] font-medium tracking-[0.08em] text-[#a1a2aa] uppercase">
                    {selectedList?.name ?? "Focus"}
                  </p>
                  <h1 className="truncate text-[34px] font-semibold tracking-[-0.045em] text-[#1c1c1e] sm:text-[42px]">
                    {viewTitle}
                  </h1>
                  <p className="mt-2 max-w-xl text-[14px] leading-6 text-[#8c8e97]">
                    {getViewDescription(selectedView)}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-2 rounded-full bg-[#f7f7f9] px-3 py-1.5 text-[11px] font-medium text-[#9a9ba3] sm:flex">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {visibleReminders.length}{" "}
                  {visibleReminders.length === 1 ? "reminder" : "reminders"}
                </div>
              </div>

              {groupedReminders.length > 0 ? (
                <div className="space-y-8" data-testid="reminder-list">
                  {groupedReminders.map(([group, groupReminders]) => (
                    <section key={group} aria-labelledby={`group-${group}`}>
                      <div className="mb-3 flex items-center gap-2 px-1">
                        <h2
                          id={`group-${group}`}
                          className="text-[13px] font-semibold text-[#555760]"
                        >
                          {group === "No Date" ? "No date" : group}
                        </h2>
                        <span className="text-[11px] text-[#b0b1b8]">
                          {groupReminders.length}
                        </span>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-[#ededf0] bg-white shadow-[0_5px_18px_rgba(31,35,45,0.035)]">
                        {groupReminders.map((reminder, index) => {
                          const list = lists.find(
                            (candidate) => candidate.id === reminder.listId
                          )
                          const isSubtasksExpanded = expandedReminderIds.has(
                            reminder.id
                          )
                          const reminderSubtasks = reminder.subtasks
                            ? (subtaskLabels[reminder.id] ??
                              Array.from(
                                { length: reminder.subtasks },
                                (_, subtaskIndex) =>
                                  `Subtask ${subtaskIndex + 1}`
                              ))
                            : []
                          return (
                            <div
                              key={reminder.id}
                              className={cn(
                                "group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-[#fbfbfc] sm:px-5",
                                reminder.subtasks && "cursor-pointer",
                                index !== groupReminders.length - 1 &&
                                  "border-b border-[#f0f0f2]"
                              )}
                              onClick={(event) => {
                                if (!reminder.subtasks) return
                                const target = event.target
                                if (
                                  target instanceof Element &&
                                  target.closest("button, input, label")
                                ) {
                                  return
                                }
                                toggleSubtasks(reminder.id)
                              }}
                              data-testid={`reminder-${reminder.id}`}
                            >
                              <Checkbox
                                isSelected={reminder.completed}
                                onChange={(isSelected) =>
                                  toggleReminder(reminder.id, isSelected)
                                }
                                aria-label={`Mark ${reminder.title} ${reminder.completed ? "incomplete" : "complete"}`}
                                className="mt-0.5 size-[19px] rounded-full border-[#c7c8ce] data-checked:border-blue-500 data-checked:bg-blue-500"
                              />
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "text-[14px] leading-5 text-[#33343a]",
                                    reminder.completed &&
                                      "text-[#a5a6ad] line-through"
                                  )}
                                >
                                  {reminder.title}
                                </p>
                                {reminder.notes && (
                                  <p className="mt-1 truncate text-[12px] leading-5 text-[#a0a1a9]">
                                    {reminder.notes}
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#999aa3]">
                                  {reminder.dueDate !== "No Date" && (
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1",
                                        reminder.dueDate === "Today" &&
                                          "text-blue-500"
                                      )}
                                    >
                                      <CalendarDays
                                        className="size-3"
                                        aria-hidden="true"
                                      />
                                      {reminder.dueLabel}
                                    </span>
                                  )}
                                  {list && (
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1",
                                        listColorTextMap[list.color]
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "size-1.5 rounded-full",
                                          listColorMap[list.color]
                                        )}
                                        aria-hidden="true"
                                      />
                                      {list.name}
                                    </span>
                                  )}
                                  {reminder.subtasks && (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="-mx-2 h-6 gap-1 px-2 text-[11px] font-normal text-[#666872]"
                                      aria-expanded={isSubtasksExpanded}
                                      aria-controls={`subtasks-${reminder.id}`}
                                      onPress={() =>
                                        toggleSubtasks(reminder.id)
                                      }
                                    >
                                      <ListChecks
                                        className="size-3"
                                        aria-hidden="true"
                                      />
                                      {reminder.subtasks} subtasks
                                    </Button>
                                  )}
                                  {reminder.priority === "high" && (
                                    <span className="inline-flex items-center gap-1 font-medium text-red-500">
                                      <ArrowDown
                                        className="size-3"
                                        aria-hidden="true"
                                      />
                                      High priority
                                    </span>
                                  )}
                                </div>
                                {isSubtasksExpanded && (
                                  <ul
                                    id={`subtasks-${reminder.id}`}
                                    className="mt-3 space-y-2 border-l border-[#dfe0e5] pl-4 text-[12px] text-[#666872]"
                                  >
                                    {reminderSubtasks.map((subtask) => (
                                      <li
                                        key={subtask}
                                        className="flex items-center gap-2"
                                      >
                                        <Circle
                                          className="size-2.5 text-[#a0a1a8]"
                                          aria-hidden="true"
                                        />
                                        {subtask}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className={cn(
                                  "-mt-1 text-[#8b8d96] transition-colors hover:bg-[#f1f1f4] hover:text-[#5f626b]",
                                  reminder.flagged &&
                                    "text-yellow-500 opacity-100"
                                )}
                                aria-label={`${reminder.flagged ? "Unflag" : "Flag"} ${reminder.title}`}
                                onPress={() => toggleFlag(reminder.id)}
                              >
                                <Star
                                  className={cn(
                                    reminder.flagged && "fill-current"
                                  )}
                                  aria-hidden="true"
                                />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-2xl border border-dashed border-[#dfe0e5] bg-[#fbfbfc] px-6 py-16 text-center"
                  data-testid="reminders-empty-state"
                >
                  <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-[#f0f0f4] text-[#a4a5ad]">
                    <Circle className="size-6" aria-hidden="true" />
                  </span>
                  <h2 className="text-[15px] font-semibold text-[#4a4b53]">
                    Nothing here yet
                  </h2>
                  <p className="mx-auto mt-2 max-w-xs text-[13px] leading-5 text-[#9a9ba3]">
                    {query
                      ? "Try a different search or clear the filter."
                      : "A quiet list is a good place to start."}
                  </p>
                </div>
              )}

              <DialogTrigger
                isOpen={isNewReminderOpen}
                onOpenChange={setIsNewReminderOpen}
              >
                <Button
                  variant="ghost"
                  className="mt-8 h-12 w-full justify-start gap-3 rounded-2xl border border-dashed border-[#dfe0e5] px-4 text-[13px] text-[#9a9ba3] hover:border-[#bfc1c9] hover:bg-[#fbfbfc] hover:text-[#5f626b]"
                  data-testid="new-reminder-button"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-blue-500 text-white">
                    <Plus className="size-3.5" aria-hidden="true" />
                  </span>
                  New reminder
                </Button>
                <Dialog className="max-w-md" data-testid="new-reminder-dialog">
                  <DialogHeader>
                    <DialogTitle>New reminder</DialogTitle>
                    <DialogDescription>
                      Capture the next thing before it slips away.
                    </DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={addReminder}>
                    <div className="space-y-2">
                      <Label htmlFor="new-reminder-title">Reminder</Label>
                      <Input
                        id="new-reminder-title"
                        value={newTitle}
                        onChange={(event) => setNewTitle(event.target.value)}
                        placeholder="What needs to happen?"
                        autoFocus
                        data-testid="new-reminder-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-reminder-notes">
                        Notes{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="new-reminder-notes"
                        value={newNotes}
                        onChange={(event) => setNewNotes(event.target.value)}
                        placeholder="Add a little context"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-reminder-list">List</Label>
                      <select
                        id="new-reminder-list"
                        value={newListId}
                        onChange={(event) => setNewListId(event.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {lists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <DialogFooter>
                      <DialogClose variant="ghost">Cancel</DialogClose>
                      <Button type="submit" isDisabled={!newTitle.trim()}>
                        Add reminder
                      </Button>
                    </DialogFooter>
                  </form>
                </Dialog>
              </DialogTrigger>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-between border-t border-[#f0f0f2] px-5 py-3 text-[11px] text-[#7b7d86] sm:px-8">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3" aria-hidden="true" /> Organized for
              your day
            </span>
            <span className="hidden sm:inline">
              Press{" "}
              <kbd className="mx-1 rounded border border-[#dedee2] bg-[#f8f8fa] px-1.5 py-0.5 font-mono text-[10px]">
                ⌘ K
              </kbd>{" "}
              to search
            </span>
          </footer>
        </main>
      </div>
    </div>
  )
}
