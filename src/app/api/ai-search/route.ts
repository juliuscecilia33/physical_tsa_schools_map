import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export interface AISearchFilters {
  city?: string;
  rating?: { min?: number; max?: number };
  reviewCount?: { min?: number; max?: number };
  sports?: string[];
  sportCountMin?: number;
  businessStatus?: string;
}

export interface AISearchResponse {
  message: string;
  filters: AISearchFilters;
  conversationContext?: string;
}

const SYSTEM_PROMPT = `You are a helpful assistant for a Texas sports facilities search application. Your job is to understand user queries about sports facilities and extract structured filter parameters.

Available facility data includes:
- name: Facility name
- address: Full address (format: "123 Street, City, State ZIP")
- location: { lat, lng } coordinates
- rating: Google rating (0-5)
- user_ratings_total: Number of reviews
- identified_sports: Array of sports offered (Basketball, Soccer, Baseball, Football, Tennis, Volleyball, Swimming, Track & Field, Golf, Hockey, Lacrosse, Softball, Wrestling, Gymnastics, Pickleball, Racquetball, Squash, Badminton, Gym/Fitness, CrossFit, Yoga, Pilates, Martial Arts, Boxing, Bowling, Skating, Climbing, Water Sports)
- sport_types: Google Places types (gym, stadium, park, etc.)
- business_status: OPERATIONAL or CLOSED
- opening_hours: Operating hours (if available)
- phone: Phone number
- website: Website URL

Your tasks:
1. Extract filter parameters from the user's natural language query
2. Respond conversationally, explaining what you're searching for
3. Be friendly and helpful
4. Handle follow-up questions and refinements

When extracting filters, look for:
- City names (e.g., "Austin", "Houston", "Dallas")
- Rating requirements (e.g., "4.5+", "highly rated", "above 4 stars")
- Review counts (e.g., "popular", "well-reviewed", "over 100 reviews")
- Specific sports (e.g., "basketball", "swimming")
- Multiple sports (e.g., "multiple sports", "variety of sports")
- Business status (e.g., "open", "operational")

Respond in this JSON format:
{
  "message": "Your friendly conversational response to the user",
  "filters": {
    "city": "Austin",
    "rating": { "min": 4.5 },
    "reviewCount": { "min": 50 },
    "sports": ["Basketball", "Soccer"],
    "sportCountMin": 2,
    "businessStatus": "OPERATIONAL"
  }
}

IMPORTANT:
- Always include a "message" field with a friendly response
- Only include filter fields that are relevant to the query
- For cities, use proper capitalization (Austin, not austin)
- For sports, use exact names from the list above
- Be conversational but concise in your responses
- If the query is unclear, ask clarifying questions in your message`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, conversationHistory } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error: "Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your .env.local file.",
          message: "AI search is not configured. Please contact the administrator."
        },
        { status: 500 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build messages array with conversation history
    const messages: Anthropic.MessageParam[] = [];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory);
    }

    messages.push({
      role: "user",
      content: query,
    });

    // Call Claude API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages,
    });

    // Extract the response content
    const contentBlock = response.content[0];
    if (contentBlock.type !== "text") {
      throw new Error("Unexpected response type from Claude API");
    }

    // Parse the JSON response from Claude
    let aiResponse: AISearchResponse;
    try {
      // Try to extract JSON from the response (Claude might wrap it in markdown)
      const jsonMatch = contentBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, create a default response
        aiResponse = {
          message: contentBlock.text,
          filters: {},
        };
      }
    } catch (parseError) {
      // If parsing fails, return the raw text as the message
      aiResponse = {
        message: contentBlock.text,
        filters: {},
      };
    }

    return NextResponse.json({
      ...aiResponse,
      conversationContext: JSON.stringify(messages.concat({
        role: "assistant",
        content: contentBlock.text,
      })),
    });
  } catch (error: any) {
    console.error("AI Search API Error:", error);

    // Handle specific Anthropic API errors
    if (error?.status === 401) {
      return NextResponse.json(
        {
          error: "Invalid Anthropic API key",
          message: "AI search authentication failed. Please check your API key configuration."
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: error?.message || "Failed to process AI search",
        message: "Sorry, I encountered an error processing your request. Please try again."
      },
      { status: 500 }
    );
  }
}
