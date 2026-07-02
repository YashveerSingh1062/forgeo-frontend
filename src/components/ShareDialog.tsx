import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { ProjectMember, ProjectRole } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ShareDialogProps {
    projectId: string;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ShareDialog({ projectId, trigger, open, onOpenChange }: ShareDialogProps) {
    const { toast } = useToast();
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<ProjectRole>("EDITOR");
    const [loading, setLoading] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [internalOpen, setInternalOpen] = useState(false);
    const [membersLoaded, setMembersLoaded] = useState(false);

    // Use controlled open state if provided, otherwise use internal state
    const isOpen = open !== undefined ? open : internalOpen;
    const handleOpenChange = (newOpen: boolean) => {
        if (onOpenChange) {
            onOpenChange(newOpen);
        } else {
            setInternalOpen(newOpen);
        }
    };

    const loadMembers = async () => {
        setLoadingMembers(true);
        try {
            console.log("Loading members for project:", projectId);
            const data = await api.getProjectMembers(projectId);
            console.log("Members loaded:", data);
            setMembers(data || []);
            setMembersLoaded(true);
        } catch (error) {
            console.error("Failed to load members:", error);
            // Show error but keep dialog open
            toast({ 
                title: "Error", 
                description: error instanceof Error ? error.message : "Failed to load members.",
                variant: "destructive" 
            });
            // Keep the dialog visible even on error
            setMembersLoaded(true);
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setLoading(true);
        try {
            await api.inviteMember(projectId, inviteEmail, inviteRole);
            toast({ title: "Invite sent", description: `Invited ${inviteEmail} to the project.` });
            setInviteEmail("");
            loadMembers();
        } catch (error) {
            console.error(error);
            toast({ title: "Failed to invite", description: "Could not send invitation.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: number, newRole: ProjectRole) => {
        try {
            await api.updateMemberRole(projectId, userId, newRole);
            setMembers(members.map(m => m.userId === userId ? { ...m, projectRole: newRole } : m));
            toast({ title: "Role updated" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
        }
    };

    const handleRemoveMember = async (userId: number) => {
        try {
            await api.removeMember(projectId, userId);
            setMembers(members.filter(m => m.userId !== userId));
            toast({ title: "Member removed" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to remove member.", variant: "destructive" });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden border-none shadow-2xl">
                <div className="p-6 pb-4">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl">Share project</DialogTitle>
                    </DialogHeader>

                    {/* Invite Section */}
                    <div className="space-y-3 mb-6">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Email or username"
                                className="flex-1 bg-muted/50 border-input/50"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                            />
                            <Button
                                onClick={handleInvite}
                                disabled={!inviteEmail.trim() || loading}
                                className="px-6"
                            >
                                Invite
                            </Button>
                        </div>
                        <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as ProjectRole)}>
                            <SelectTrigger className="w-full bg-muted/50 border-input/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="VIEWER">Can view</SelectItem>
                                <SelectItem value="EDITOR">Can edit</SelectItem>
                                <SelectItem value="OWNER">Owner</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Members List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-muted-foreground">People with access</h4>
                            {!membersLoaded && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={loadMembers}
                                    disabled={loadingMembers}
                                >
                                    {loadingMembers ? "Loading..." : "Load"}
                                </Button>
                            )}
                        </div>

                        {!membersLoaded && !loadingMembers ? (
                            <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
                                Click "Load" to see who has access to this project.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {(!members || members.length === 0) && (
                                    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback>ME</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 text-sm">
                                            <div className="font-medium">You</div>
                                            <div className="text-xs text-muted-foreground">Owner</div>
                                        </div>
                                        <span className="text-xs text-muted-foreground px-2">Owner</span>
                                    </div>
                                )}

                                {Array.isArray(members) && members.map((member) => {
                                    try {
                                        const displayName = member?.name || member?.username || "You";
                                        const displayInitial = displayName ? displayName.charAt(0).toUpperCase() : "?";
                                        const role = member?.projectRole || "VIEWER";
                                        
                                        return (
                                            <div key={member?.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarFallback className="text-xs font-medium">
                                                        {displayInitial}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 text-sm">
                                                    <div className="font-medium truncate">{displayName}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{member?.username || "Owner"}</div>
                                                </div>

                                                {role === 'OWNER' ? (
                                                    <span className="text-xs text-muted-foreground px-2 whitespace-nowrap">Owner</span>
                                                ) : (
                                                    <Select
                                                        defaultValue={role}
                                                        onValueChange={(val) => {
                                                            if (val === 'REMOVE') {
                                                                if (member?.userId) handleRemoveMember(member.userId);
                                                            } else {
                                                                if (member?.userId) handleRoleChange(member.userId, val as ProjectRole);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 w-[100px] text-xs border-none bg-transparent hover:bg-muted focus:ring-1 shadow-none">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent align="end">
                                                            <SelectItem value="EDITOR">Can edit</SelectItem>
                                                            <SelectItem value="VIEWER">Can view</SelectItem>
                                                            <SelectItem value="REMOVE" className="text-destructive focus:text-destructive">Remove</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>
                                        );
                                    } catch (err) {
                                        console.error("Error rendering member:", member, err);
                                        return null;
                                    }
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
