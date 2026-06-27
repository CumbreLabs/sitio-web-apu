# APU Mountain Travel Website - Developer Guide

## Project Overview

Official website for APU Mountain Travel (APU Viajes de Montaña), a Colombian company specializing in rock climbing, trekking, and mountaineering experiences. The site features a modern, responsive design with bilingual support and smooth navigation.

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Custom CSS with CSS Variables for theming
- **Icons**: Font Awesome 6.0
- **Analytics**: Google Analytics & Tag Manager
- **Languages**: Spanish (main) and English

## Project Structure

```text
apu-website/
├── index.html              # Spanish version (main)
├── en/
│   └── index.html         # English version
├── static/
│   ├── css/
│   │   └── styles.css     # Main stylesheet
│   ├── js/
│   │   └── main.js        # JavaScript functionality
│   └── images/            # All image assets
│       ├── favicon-source.jpg
│       ├── foto-1.jpg to foto-7.jpg
│       └── hero-bg.jpg
├── assets/                # Ignored - raw design assets
├── .gitignore            # Git ignore configuration
├── package.json          # NPM configuration
├── .eslintrc.json        # JavaScript linting rules
├── .stylelintrc.json     # CSS linting rules
├── .htmlhintrc           # HTML linting rules
├── CLAUDE.md             # This developer guide
└── README.md             # Public documentation
```

## Key Features Implemented

### Navigation System

- Fixed header with smooth scroll navigation
- Padding-top/negative-margin technique for anchor offset (130px)
- Mobile hamburger menu with smooth X animation
- Bilingual navigation links
- Language switcher (ES/EN) visible on both mobile and desktop

### Responsive Design

- Mobile-first approach with breakpoint at 768px
- Service cards with proper mobile layout:
  - Width: calc(100% - 30px) with 15px margins
  - Flexible height adapting to content
  - Proper centering and spacing
- Flexible grid layouts using CSS Grid
- Touch-friendly interface elements
- Overflow-x hidden to prevent horizontal scroll

### Interactive Elements

- Image carousel with indicators and controls
- WhatsApp floating action button
- Hover effects on buttons and cards
- Smooth scroll behavior for anchor links
- Hamburger menu with clean X transformation

## CSS Architecture

### Color Variables

```css
--dark-teal: #1a4f56; /* Primary brand color */
--teal: #00b2a0; /* Secondary brand color */
--orange: #e8a562; /* Accent color for CTAs */
--dark-blue: #2a5f67; /* Dark sections */
--navbar-bg: #091c1e; /* Dark navbar background */
--white: #fff;
--light-bg: #f9f9f9;
```

### Key Components

- `.hero` - Full-screen hero section with overlay
- `.services-grid` - Responsive grid for service cards
- `.service-card` - Individual service card styling
- `.featured-plans` - Highlighted course section
- `.carousel-container` - Image gallery carousel
- `.float-wa` - WhatsApp floating button
- `.hamburger` - Mobile menu toggle with animation

## JavaScript Functionality

Located in `/static/js/main.js`:

- Hamburger menu toggle with active state
- Smooth scroll navigation for anchor links
- Carousel controls (next/prev/indicators)
- Auto-rotation for carousel (5 second intervals)
- Touch/swipe support for mobile carousel
- Language switcher functionality (if implemented)

## Navigation Fixes Applied

All navigation anchors use the following pattern to account for fixed header:

```html
<h2 style="padding-top: 130px; margin-top: -130px;">Section Title</h2>
```

Applied to:

- Services: `#servicios` / `#services`
- Plans: `#planes` / `#plans`
- Gallery: `#galeria` / `#gallery`
- Contact: `#contacto` / `#contact`

## Mobile-Specific Optimizations

### Hamburger Menu

- Position: right: 25px for proper edge spacing
- Clean X animation using absolute positioning
- Spans properly centered and rotated
- 30x30px touch target

### Service Cards

- Full width with 15px side margins
- Removed max-width restriction on mobile
- Flexible height based on content
- Proper text sizing and line-height

### Footer Contact

- Email and phone split into two lines
- Pipe separator hidden on mobile
- Block display for contact links
- Improved tap targets

### Featured Plans

- Reduced padding (30px 20px)
- Smaller font sizes for mobile
- Proper width calculation with margins

## SEO & Performance

- Semantic HTML structure
- Proper meta tags for SEO
- Open Graph tags for social sharing
- Twitter Card integration
- Alt text for all images in both languages
- Lazy loading for carousel images
- Optimized font loading with local fonts

## Pricing Display

- Spanish version: Shows prices in format $XXX,XXX
- English version: Shows prices with COP suffix ($XXX,XXX COP)
- Consistent pricing across both versions
- Special discount note for TREPA members (10% off)

## Testing Notes

- Navigation tested with Playwright browser automation
- Cross-browser compatibility verified
- Mobile responsiveness tested on various devices
- Anchor scrolling behavior confirmed working
- Hamburger menu X animation tested on mobile
- Service card layout verified on different screen sizes

## Linting & Formatting

- **Prettier**: Configured for consistent code formatting
- **ESLint**: JavaScript linting (no errors)
- **Stylelint**: CSS linting (21 warnings - mostly intentional duplicates for media queries)
- **HTMLHint**: HTML validation (no errors)

Run commands:

```bash
npm run format          # Format all files
npm run lint           # Run all linters
npm run validate       # Check formatting and run linters
```

## Known CSS Linting Warnings

The CSS has some intentional patterns that trigger warnings:

1. Duplicate selectors in media queries (needed for responsive overrides)
2. Animation naming (fadeIn vs fade-in) - kept for consistency
3. Quote styles - mixed due to Prettier formatting

These don't affect functionality and are acceptable.

## Deployment

- Static site, can be deployed on any web server
- No build process required
- Assets served from `/static/` directory
- Supports both root and subdomain deployment
- `.playwright-mcp/` and `assets/` folders excluded from git

## Contact Integration

- WhatsApp: +57 316 0557537 (with floating button)
- Email: apuviajesdemontana@gmail.com
- Instagram: @apuviajesdemontana
- Website: www.viajesapu.com

## Recent Updates (Latest Session)

1. Fixed mobile service card layout - proper centering and width
2. Fixed hamburger menu X animation - no more cropping
3. Adjusted hamburger menu spacing from edge (25px total)
4. Split email/phone into two lines on mobile
5. Added COP suffix to English prices for clarity
6. Improved mobile featured plans card styling
7. Added overflow-x: hidden to prevent horizontal scroll
8. Updated .gitignore to exclude assets/ and .playwright-mcp/
9. Configured linting and formatting tools
10. Created comprehensive README.md for public documentation

## Future Improvements & Ideas

1. **Performance**
   - Consider implementing critical CSS inlining
   - Add webp image format support with fallbacks
   - Implement service worker for offline support

2. **Features**
   - Add testimonials section
   - Implement contact form instead of just links
   - Add interactive map showing climbing locations
   - Create individual pages for each service/expedition

3. **Accessibility**
   - Add skip navigation link
   - Improve keyboard navigation for carousel
   - Add ARIA labels for better screen reader support
   - Ensure all interactive elements have focus states

4. **Internationalization**
   - Consider adding more languages (Portuguese for Brazilian tourists)
   - Implement proper i18n system instead of data attributes
   - Add language-specific URLs (/es/, /en/)

5. **Content**
   - Add more detailed service descriptions
   - Include difficulty ratings visually
   - Add equipment lists for each activity
   - Create a FAQ section

6. **Technical**
   - Consider migrating to a static site generator for easier maintenance
   - Implement CSS custom properties for all spacing values
   - Add dark mode support
   - Implement proper image optimization pipeline
