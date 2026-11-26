/**
 * Words on the landing page (`welcome/index.html`). Kept apart from the app's
 * string table so the page stays small; Zico tells the story in his own voice.
 */
export const landing = {
  skip: 'Skip to the app',
  openApp: 'Open the app',
  tryDemo: 'Try it with sample books',
  hero: {
    woof: 'Woof!',
    lines: ['Hi, I’m Zico!', 'I’m the beagle behind Readhound.', 'Beagles follow their nose. I follow your books.'],
    pitch: 'Readhound keeps track of what you read, puts every book in its place and turns your reading into stories, stats and small celebrations.',
    tour: 'Let me show you around',
    tapMe: 'Tap Zico to say hello',
  },
  chapters: [
    {
      id: 'find',
      kicker: 'Chapter 1',
      title: 'First, I sniff out your books',
      body: 'Search millions of books on Open Library, or point your phone at the barcode on the back and I’ll fetch it. Can’t find it? Type it in yourself. Coming from Goodreads? Bring your whole library over in one go.',
      points: ['Search by title, author or ISBN', 'Scan barcodes with your camera', 'Import from Goodreads', 'Add or fix anything by hand'],
    },
    {
      id: 'sort',
      kicker: 'Chapter 2',
      title: 'Then every book gets its place',
      body: 'To read, reading, finished, or that one you gave up on: every book lands on the right pile. Make your own lists, tag genres (I’ll suggest them), mark the books you own and snap a photo of your own cover.',
      points: ['To read, Reading, Finished and DNF piles', 'Your own lists and genres', 'Owned books and your own cover photos', 'The exact edition you own, page by page'],
    },
    {
      id: 'shelf',
      kicker: 'Chapter 3',
      title: 'It all lines up on your shelf',
      body: 'Flip your library into a real bookshelf. Spines take their colour from the covers and their width from the page count. Tap one and I’ll pull it out for you.',
      points: ['List, grid and shelf views', 'Spines coloured by their covers'],
    },
    {
      id: 'series',
      kicker: 'Chapter 4',
      title: 'I keep your series in order',
      body: 'I spot when a book is part of a series and keep the whole run in order, so you always know which one comes next.',
      points: ['Series found automatically', 'Next in series, right on Home'],
    },
    {
      id: 'stats',
      kicker: 'Chapter 5',
      title: 'Your reading tells a story',
      body: 'Log your reading as you go and watch the numbers grow: pages per month, streaks, favourite genres and authors, how fast you finish, and a Year in review to look back on when December comes.',
      points: ['Dozens of charts and stats', 'Reading streaks and yearly goals', 'Year in review', 'Rereads counted as their own reads'],
    },
    {
      id: 'cheer',
      kicker: 'Chapter 6',
      title: 'And I cheer you on',
      body: 'Set a weekly pages goal and I’ll keep an eye on it. I bark when you add a book, cheer when you hit a milestone, and share a line from a classic now and then. There are achievements to collect, too.',
      points: ['Weekly pages goal', 'Achievements to unlock', 'Hundreds of book quotes, checked word for word', 'Picks for what to read next'],
    },
    {
      id: 'outfits',
      kicker: 'Chapter 7',
      title: 'I dress for the occasion',
      body: 'From six in the evening I put on my pyjamas, and all of December I wear my Santa hat. When it snows on your screen, that’s me too.',
      points: [],
    },
    {
      id: 'private',
      kicker: 'Chapter 8',
      title: 'Your books stay with you',
      body: 'No account, no sign-up, no tracking. Your library lives on your own device and works offline. I’ll remind you to make a backup now and then, and you can export everything whenever you like.',
      points: ['No account needed', 'Works offline', 'Backups and export', 'Add it to your home screen'],
    },
  ],
  outfits: { day: 'Daytime', night: 'Pyjama time', december: 'December' },
  goal: { label: 'This week', pages: '164 of 200 pages' },
  quotes: [
    { text: 'One half of the world cannot understand the pleasures of the other.', source: 'Jane Austen, Emma' },
    { text: 'Till this moment I never knew myself.', source: 'Jane Austen, Pride and Prejudice' },
    { text: 'There is no charm equal to tenderness of heart.', source: 'Jane Austen, Emma' },
  ],
  achievements: ['First book', 'Week streak', 'Series starter'],
  statuses: ['To read', 'Reading', 'Finished', 'DNF'],
  search: 'Assassin’s Apprentice',
  next: 'Next',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  end: {
    title: 'Ready to go sniff out your next book?',
    body: 'Readhound is free and runs right in your browser, on your phone or your computer.',
  },
  footer: 'Book data from Open Library. Made with a wagging tail.',
} as const
