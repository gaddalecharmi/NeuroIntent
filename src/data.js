// ─── helpers ────────────────────────────────────────────────────────────────
function node(title, icon, hint, children) {
  return { title, icon, hint, children };
}
function leaf(title, icon, message) {
  return { title, icon, message: message || `Please help me with: ${title}.` };
}
function leafMsg(title, icon, message) {
  return { title, icon, message };
}

// ─── pain detail builders ────────────────────────────────────────────────────
function painNode(place, types, severities) {
  return {
    title: place,
    icon: painIcon(place),
    hint: `Pain location: ${place}`,
    isPainLocation: true,
    place,
    types,
    severities: severities || ["Mild", "Moderate", "Severe"],
    message: null,
  };
}

function painIcon(place) {
  const map = {
    Head: "🧠", Chest: "🫀", Stomach: "🫃", Back: "🦴",
    Arm: "💪", Hand: "🖐️", Leg: "🦵", Foot: "🦶",
    "Difficulty Breathing": "🌬️", Other: "❓",
  };
  return map[place] || "❓";
}

// ─── category tree ────────────────────────────────────────────────────────────
export const tree = {
  most_needed: {
    title: "Most Needed",
    icon: "⭐",
    hint: "Quick communication options",
    voicePreview: "Most needed. Choose from yes, no, please, thank you, I need help, or need something.",
    children: [
      leafMsg("Yes", "✅", "Yes."),
      leafMsg("No", "❌", "No."),
      leafMsg("Please", "🤲", "Please."),
      leafMsg("Thank You", "🙏", "Thank you."),
      leafMsg("I Need Help", "🆘", "I need help. Please come to me."),
      leafMsg("Need Something", "❓", "I need something. Please check on me."),
    ],
  },

  water: {
    title: "Water",
    icon: "💧",
    hint: "Drinks and hydration",
    voicePreview: "Water. You can choose water, cold water, warm water, drinks and beverages, juices, or electrolytes.",
    children: [
      leafMsg("Water", "🥛", "Please give me some water."),
      leafMsg("Cold Water", "🧊", "Please give me cold water."),
      leafMsg("Warm Water", "☕", "Please give me warm water."),
      leafMsg("Drinks & Beverages", "🥤", "Please give me a drink or beverage."),
      leafMsg("Juices", "🍊", "Please give me some juice."),
      leafMsg("Electrolytes", "⚡", "Please give me an electrolyte drink."),
    ],
  },

  food: {
    title: "Food",
    icon: "🍽️",
    hint: "Meals, snacks and drinks",
    voicePreview: "Food. You can choose from meals like rice, dal, or roti, snacks like biscuits or fruit, or drinks like tea, coffee, or milk.",
    children: [
      node("Meals", "🍚", "Choose a meal", [
        leafMsg("Rice", "🍚", "I would like some rice please."),
        leafMsg("Dal", "🥣", "I would like some dal please."),
        leafMsg("Roti / Chapati", "🫓", "I would like roti or chapati please."),
        leafMsg("Idli", "🫔", "I would like some idli please."),
        leafMsg("Dosa", "🥞", "I would like some dosa please."),
        leafMsg("Upma", "🥣", "I would like some upma please."),
        leafMsg("Khichdi", "🍲", "I would like some khichdi please."),
        leafMsg("Vegetables", "🥦", "I would like some vegetables please."),
        leafMsg("Breakfast", "🥣", "I would like breakfast please."),
        leafMsg("Lunch", "🍛", "I would like lunch please."),
        leafMsg("Dinner", "🍽️", "I would like dinner please."),
      ]),
      node("Snacks", "🍎", "Choose a snack", [
        leafMsg("Biscuits", "🍪", "I would like some biscuits please."),
        leafMsg("Bread", "🍞", "I would like some bread please."),
        leafMsg("Fruit", "🍎", "I would like some fruit please."),
        leafMsg("Sandwich", "🥪", "I would like a sandwich please."),
        leafMsg("Nuts", "🥜", "I would like some nuts please."),
        leafMsg("Chips", "🥔", "I would like some chips please."),
        leafMsg("Crackers", "🫙", "I would like some crackers please."),
        leafMsg("Cake", "🎂", "I would like some cake please."),
        leafMsg("Yogurt", "🥛", "I would like some yogurt please."),
      ]),
      node("Drinks", "☕", "Choose a drink", [
        leafMsg("Milk", "🥛", "I would like some milk please."),
        leafMsg("Tea", "🍵", "I would like some tea please."),
        leafMsg("Coffee", "☕", "I would like some coffee please."),
        leafMsg("Juice", "🍊", "I would like some juice please."),
        leafMsg("Buttermilk", "🥛", "I would like some buttermilk please."),
        leafMsg("Smoothie", "🥤", "I would like a smoothie please."),
      ]),
    ],
  },

  bathroom: {
    title: "Bathroom",
    icon: "🚻",
    hint: "Toilet and personal care",
    voicePreview: "Bathroom. You can choose toilet, need a bath, head bath, bath with hot water, bath with cold water, or need to pass stool.",
    children: [
      leafMsg("Toilet", "🚽", "I need to use the toilet please."),
      leafMsg("Need a Bath", "🚿", "I need a bath please."),
      leafMsg("Head Bath", "🚿", "I need a head bath please."),
      leafMsg("Bath with Hot Water", "♨️", "I need a bath with hot water please."),
      leafMsg("Bath with Cold Water", "🧊", "I need a bath with cold water please."),
      leafMsg("Need to Pass Stool", "🚻", "I need to pass stool. Please assist me."),
    ],
  },

  pain: {
    title: "Pain",
    icon: "🌡️",
    hint: "Tell us where it hurts",
    voicePreview: "Pain. You can choose head, chest, stomach, back, arm, hand, leg, foot, difficulty breathing, or other.",
    children: [
      painNode("Head",
        ["Throbbing", "Sharp", "Dull", "Pressure", "Burning", "Other type"],
        ["Mild", "Moderate", "Severe"]
      ),
      painNode("Chest",
        ["Pain", "Tightness", "Pressure", "Discomfort", "Other type"],
        ["Mild", "Moderate", "Severe"]
      ),
      painNode("Stomach",
        ["Cramping", "Sharp pain", "Burning", "Bloating", "Discomfort", "Other type"],
        ["Mild", "Moderate", "Severe"]
      ),
      painNode("Back",
        ["Aching", "Sharp pain", "Stiffness", "Burning", "Other type"],
        ["Mild", "Moderate", "Severe"]
      ),
      painNode("Arm",
        ["Aching", "Sharp pain", "Numbness", "Tingling", "Weakness", "Other type"],
        ["Mild", "Moderate", "Severe"]
      ),
      painNode("Hand",
        ["Aching", "Sharp pain", "Numbness", "Tingling", "Weakness", "Other type"],
        ["Mild", "Moderate", "Severe"]
      ),
      painNode("Leg",
        ["Aching", "Cramps", "Sharp pain", "Numbness", "Swelling", "Tingling", "Other type"],
        ["Mild", "Moderate", "Severe"]
      ),
      painNode("Foot",
        ["Aching", "Cramps", "Sharp pain", "Numbness", "Swelling", "Tingling", "Other type"],
        ["Mild", "Moderate", "Severe"]
      ),
      {
        title: "Difficulty Breathing",
        icon: "🌬️",
        hint: "Breathing difficulty — urgent",
        isDifficultyBreathing: true,
        message: null,
      },
      leafMsg("Other", "❓", "I am in pain. Please help me."),
    ],
  },

  unwell: {
    title: "Feeling Unwell",
    icon: "🤒",
    hint: "General symptoms and discomfort",
    voicePreview: "Feeling unwell. You can choose dizzy, nauseous, feel like vomiting, feeling weak, tired, feverish, feeling unwell, or other.",
    children: [
      leafMsg("Dizzy", "😵", "I am feeling dizzy."),
      leafMsg("Nauseous", "🤢", "I am feeling nauseous."),
      leafMsg("Feel Like Vomiting", "🤮", "I feel like vomiting. Please help me."),
      leafMsg("Feeling Weak", "😫", "I am feeling weak."),
      leafMsg("Tired", "😴", "I am feeling tired."),
      leafMsg("Feverish", "🌡️", "I feel feverish. Please check my temperature."),
      leafMsg("Feeling Unwell", "🤒", "I am not feeling well. Please help me."),
      leafMsg("Other", "❓", "I am feeling unwell. Please help me."),
    ],
  },

  health: {
    title: "Health & Care",
    icon: "💊",
    hint: "Care, medicine and health",
    voicePreview: "Health and care. You can choose need medicine, temperature check, routine health assistance, or help with personal care.",
    children: [
      leafMsg("Need Medicine", "💊", "I need my medicine please."),
      leafMsg("Temperature Check", "🌡️", "Please check my temperature."),
      leafMsg("Routine Health Help", "🩺", "I need routine health assistance please."),
      leafMsg("Personal Care Help", "🧴", "I need help with personal care please."),
    ],
  },

  comfort: {
    title: "Comfort",
    icon: "🛏️",
    hint: "Help me feel comfortable",
    voicePreview: "Comfort. You can choose adjust my pillow, change my position, too hot, too cold, need a blanket, or make me comfortable.",
    children: [
      leafMsg("Adjust My Pillow", "🛏️", "Please adjust my pillow."),
      leafMsg("Change My Position", "↕️", "Please help me change my position."),
      leafMsg("I Am Too Hot", "🌡️", "I am too hot. Please cool me down."),
      leafMsg("I Am Too Cold", "❄️", "I am too cold. Please warm me up."),
      leafMsg("Need a Blanket", "🧣", "I need a blanket please."),
      leafMsg("Make Me Comfortable", "🤗", "Please make me comfortable."),
    ],
  },

  talk: {
    title: "Talk to People",
    icon: "💬",
    hint: "People and social messages",
    voicePreview: "Talk to people. You can choose caregiver, family, or send a social message like hello, thank you, or I love you.",
    children: [
      leafMsg("Talk to Caregiver", "👩‍⚕️", "I would like to talk to my caregiver please."),
      node("Family", "👨‍👩‍👧", "Who would you like to talk to?", [
        leafMsg("Talk to Family", "👨‍👩‍👧", "I would like to talk to my family please."),
        leafMsg("Mother", "👩", "I would like to talk to my mother please."),
        leafMsg("Father", "👨", "I would like to talk to my father please."),
        leafMsg("Sibling", "👥", "I would like to talk to my sibling please."),
        leafMsg("Other Family", "👪", "I would like to talk to a family member please."),
      ]),
      node("Social Messages", "👋", "Choose a message", [
        leafMsg("Hello", "👋", "Hello!"),
        leafMsg("Thank You", "🙏", "Thank you very much."),
        leafMsg("Please", "🤲", "Please."),
        leafMsg("I Love You", "❤️", "I love you."),
        leafMsg("Good Morning", "🌅", "Good morning!"),
        leafMsg("Good Night", "🌙", "Good night!"),
        leafMsg("Yes", "✅", "Yes."),
        leafMsg("No", "❌", "No."),
      ]),
    ],
  },

  help: {
    title: "Help",
    icon: "🆘",
    hint: "Get assistance quickly",
    voicePreview: "Help. You can choose I need help, urgent help, help me more, help with position, or other.",
    children: [
      leafMsg("I Need Help", "🆘", "I need help. Please come to me."),
      leafMsg("Urgent Help", "🚨", "I need urgent help right now. Please come immediately."),
      leafMsg("Help Me More", "🙏", "I need more help please."),
      leafMsg("Help with Position", "🛏️", "I need help with my position please."),
      leafMsg("I Need Something", "❓", "I need something. Please check on me."),
      leafMsg("Other", "💬", "I need assistance. Please help me."),
    ],
  },

  other: {
    title: "Other",
    icon: "⋯",
    hint: "Other requests",
    voicePreview: "Other. You can choose music, entertainment, phone, activities, or other.",
    children: [
      leafMsg("Music", "🎵", "I would like to listen to music please."),
      leafMsg("Entertainment", "📺", "I would like some entertainment please."),
      leafMsg("Phone", "📱", "I need my phone please."),
      leafMsg("Activities", "🎯", "I would like to do an activity please."),
      leafMsg("Other", "💬", "I need something else. Please help me."),
    ],
  },
};

// Domain order for the home page grid
export const domainOrder = [
  "most_needed", "water", "food", "bathroom", "pain",
  "unwell", "health", "comfort", "talk",
  "help", "other",
];

// Quick response definitions
export const quickResponses = [
  { id: "yes",       icon: "✅", label: "Yes",          message: "Yes." },
  { id: "no",        icon: "❌", label: "No",           message: "No." },
  { id: "please",    icon: "🤲", label: "Please",       message: "Please." },
  { id: "thankyou",  icon: "🙏", label: "Thank You",    message: "Thank you." },
  { id: "needhelp",  icon: "🆘", label: "I Need Help",  message: "I need help. Please come to me." },
  { id: "needsomething", icon: "❓", label: "Need Something", message: "I need something. Please check on me." },
];
