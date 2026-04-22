# Implementation Examples

## Level Data Structure

When creating or editing a level in the admin panel, here's what each field stores:

```javascript
{
  // Required Fields
  id: "retray",                                    // Unique identifier
  name: "ReTraY",                                  // Display name
  points: 25.5,                                    // Points awarded
  current_rank: 3,                                 // Current ranking
  
  // Optional Fields
  initial_rank: 1,                                 // Starting rank
  verifier: "Freeze",                              // Verifier name
  verifier_fruit: "🍒",                            // Verifier's fruit emoji
  verify_date: "2024-04-22",                       // Verification date (YYYY-MM-DD)
  image_url: "https://example.com/level.png",     // Level thumbnail
  showcase_url: "https://youtube.com/watch?v=...", // Video showcase
  verification_url: "https://example.com/verify",  // Verification link
  victors: ["Player1", "Player2", "Player3"]      // List of victors
}
```

## User Data Structure

```javascript
{
  id: "freeze",                         // User ID
  username: "Freeze",                   // Display username
  completedLevels: ["retray", "level2"], // Array of completed level IDs
  points: 50.5                          // Total points (calculated automatically)
}
```

## Form Field Requirements

### Level Form
- **Required:** Level ID, Level Name, Points, Current Rank
- **Optional:** Initial Rank, Verifier, Verifier Fruit, Verify Date, Image URL, Showcase URL, Verification URL, Victors
- **Actions:** Save Level, Clear Form, Delete Level (appears when editing)

### User Form
- **Required:** User ID, Username
- **Checkboxes:** Select all completed levels (shows level name + points)
- **Auto-calculation:** Points are automatically calculated based on selected levels
- **Actions:** Save User, Clear Form, Delete User (appears when editing)

## Workflow Examples

### Adding a New Level

1. Navigate to Admin panel
2. Login with admin credentials
3. In "Add / Update Level" form, enter:
   - Level ID: `my-level`
   - Level Name: `My Awesome Level`
   - Points: `30`
   - Current Rank: `5`
   - Verifier: `YourName`
4. (Optional) Add image URL, showcase URL, verification URL
5. (Optional) Add victors: `Player1, Player2, Player3`
6. Click "Save Level"
7. Level now appears in "Levels (Click to Edit)" section

### Editing an Existing Level

1. In Admin panel, find level in "Levels (Click to Edit)" list
2. Click on the level card
3. Form fields auto-populate
4. Make desired changes
5. Click "Save Level"
6. Changes are reflected immediately

### Adding Victors

When editing a level, add victors as comma-separated list:
```
Player1, Player2, Player3, Another Player
```

They will display on the leaderboard as:
```
Victors: Player1, Player2, Player3, Another Player
```

### Assigning Levels to Users

1. In Admin panel, open "Add / Update User"
2. Enter User ID and Username
3. Check the boxes for levels the user has completed
4. Points are automatically calculated
5. Click "Save User"

Example: If user completes:
- Level A (25 pts) ✓
- Level B (30 pts) ✓
- Level C (20 pts) ✗

Total points = 25 + 30 = 55 points

### Deleting Entries

1. Click the level/user card you want to delete
2. The delete button appears in the form
3. Click "Delete [Type]"
4. Confirm in the dialog
5. Entry is immediately removed from database

## Display Features on Leaderboard

### Images
If an image URL is provided when creating a level:
- Image displays above the level details
- Thumbnail is bounded by 250px max height
- Maintains aspect ratio
- Alt text shows level name

### Links
If showcase and/or verification URLs are provided:
- Links appear as styled buttons below level info
- "Showcase" button links to the provided URL
- "Verification" button links to verification URL
- Links open in new browser tab
- Never affects your current page

### Victors
If victors are provided:
- They display in a separate section
- Formatted as: "Victors: Player1, Player2, Player3"
- Names are comma-separated as entered

## Status Messages

The admin panel shows status messages:
- **Success:** "Level saved successfully.", "User saved successfully."
- **Deletion:** "Deleting level...", "Level deleted successfully."
- **Errors:** "Level ID, name, and current rank are required.", etc.
- **Auth:** "Admin access granted.", "Not logged in"

All messages disappear when you clear the form or perform another action.
