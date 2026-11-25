/**
 * English UI strings. Every user-facing string lives here so a Danish file
 * (`da.ts`) with the same shape can be added later.
 */
export const en = {
  appName: 'Readhound',
  tabs: {
    home: 'Home',
    search: 'Search',
    library: 'Library',
    stats: 'Stats',
    profile: 'Profile',
  },
  mainNav: 'Main navigation',
  screens: {
    home: {
      title: 'Currently reading',
      empty: 'Nothing on the go. Find a book in Search to start tracking it.',
    },
    search: {
      title: 'Search',
      placeholder: 'Title, author or ISBN',
      comingSoon: 'Search for books in Open Library will appear here.',
    },
    library: {
      title: 'Library',
      empty: 'Your library is empty.',
    },
    stats: {
      title: 'Stats',
      empty: 'Stats appear once you start logging your reading.',
    },
    profile: {
      title: 'Profile',
      description: 'Goals, lists, categories, export and settings will live here.',
    },
  },
  notFound: {
    title: 'Page not found',
    backHome: 'Back to Home',
  },
  pwa: {
    offlineReady: 'Readhound is ready to work offline.',
    dismiss: 'Dismiss',
  },
}

export type Strings = typeof en
