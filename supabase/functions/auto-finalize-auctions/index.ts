import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for ended auctions to finalize...");

    // Find all active auctions that have ended
    const { data: endedAuctions, error: fetchError } = await supabase
      .from("auctions")
      .select("id, card_id, ends_at")
      .eq("status", "active")
      .lt("ends_at", new Date().toISOString());

    if (fetchError) {
      console.error("Error fetching ended auctions:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!endedAuctions || endedAuctions.length === 0) {
      console.log("No ended auctions to finalize");
      return new Response(
        JSON.stringify({ message: "No ended auctions to finalize", finalized: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${endedAuctions.length} ended auctions to finalize`);

    let finalizedCount = 0;
    const errors: string[] = [];

    // Finalize each ended auction
    for (const auction of endedAuctions) {
      console.log(`Finalizing auction ${auction.id} for card ${auction.card_id}`);
      
      const { data, error } = await supabase.rpc("end_auction", {
        p_auction_id: auction.id,
      });

      if (error) {
        console.error(`Error finalizing auction ${auction.id}:`, error);
        errors.push(`Auction ${auction.id}: ${error.message}`);
      } else {
        console.log(`Successfully finalized auction ${auction.id}:`, data);
        finalizedCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Finalized ${finalizedCount} auctions`,
        finalized: finalizedCount,
        total: endedAuctions.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
