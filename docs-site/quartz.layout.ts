import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [
    // The defaults pack every note into the middle, where forty titles overlap
    // into an unreadable smear. Spreading the nodes and shrinking the labels is
    // what makes a dot legibly one article; hovering one dims the rest, which is
    // the only thing that fully separates the decision records, since they all
    // orbit the same hub at the same radius.
    Component.Graph({
      localGraph: {
        repelForce: 0.9,
        centerForce: 0.28,
        linkDistance: 45,
        fontSize: 0.55,
        // Label alpha is (zoom * opacityScale - 1) / 3.75, so at this zoom the
        // default of 1 renders every title invisible until the reader zooms in.
        opacityScale: 3.4,
      },
      globalGraph: {
        scale: 0.85,
        repelForce: 3.4,
        centerForce: 0.05,
        linkDistance: 130,
        fontSize: 0.5,
        opacityScale: 4.6,
      },
    }),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [],
}
