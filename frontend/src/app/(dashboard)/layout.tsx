'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { SidebarLayout } from '@/components/ui/sidebar-layout';
import { Navbar, NavbarSection, NavbarSpacer } from '@/components/ui/navbar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useAuthStore } from '@/stores/auth-store';
import { authService } from '@/features/auth/services/auth.service';
import { usePermissionsSync } from '@/features/settings/hooks/use-permissions-sync';
import { ToolFailureBanner } from '@/features/ai-agents/components/tool-failure-banner';
import { formatWorkspaceTitle, getWorkspacePageTitle } from '@/lib/browser-title';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, organizations, activeOrgId, setAuth, setActiveOrg } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  usePermissionsSync();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    if (user) {
      setIsLoading(false);
      return;
    }

    authService
      .getMe()
      .then((data) => {
        setAuth(data.user, data.organizations);
        // Ensure activeOrgId is set (setAuth handles this, but double-check)
        const currentOrgId = localStorage.getItem('active_org_id');
        if (!currentOrgId && data.organizations.length > 0) {
          setActiveOrg(data.organizations[0].id);
        }
        setIsLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.replace('/login');
      });
  }, [router, user, setAuth, setActiveOrg]);

  useEffect(() => {
    const activeOrg = organizations.find((org) => org.id === activeOrgId);
    const title = formatWorkspaceTitle(
      activeOrg?.name ?? 'Chat BullQ',
      getWorkspacePageTitle(pathname),
    );
    document.title = title;
  }, [organizations, activeOrgId, pathname]);

  useEffect(() => {
    const activeOrg = organizations.find((org) => org.id === activeOrgId);
    const iconUrl = activeOrg?.browserTabIconUrl?.trim();
    const head = document.head;
    if (!head) return;

    const ensureLink = (rel: string) => {
      let link = head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        head.appendChild(link);
      }
      return link;
    };

    const iconLink = ensureLink('icon');
    if (!iconLink.dataset.defaultHref) {
      iconLink.dataset.defaultHref = iconLink.getAttribute('href') || '/icon.png';
    }
    iconLink.href = iconUrl || iconLink.dataset.defaultHref;

    const shortcutLink = ensureLink('shortcut icon');
    if (!shortcutLink.dataset.defaultHref) {
      shortcutLink.dataset.defaultHref =
        shortcutLink.getAttribute('href') || iconLink.dataset.defaultHref || '/icon.png';
    }
    shortcutLink.href = iconUrl || shortcutLink.dataset.defaultHref;
  }, [organizations, activeOrgId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarLayout
      sidebar={<AppSidebar />}
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection><></></NavbarSection>
        </Navbar>
      }
    >
      <div className="flex h-full flex-col">
        <ToolFailureBanner />
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </SidebarLayout>
  );
}
