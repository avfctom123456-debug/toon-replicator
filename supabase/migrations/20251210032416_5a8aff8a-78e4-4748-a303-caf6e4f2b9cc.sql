-- Friends table for friend relationships
CREATE TABLE public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their friend relationships" ON public.friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can send friend requests" ON public.friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friend requests they received" ON public.friends
  FOR UPDATE USING (auth.uid() = friend_id OR auth.uid() = user_id);

CREATE POLICY "Users can delete their friend relationships" ON public.friends
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Direct challenge invites (unranked by default)
CREATE TABLE public.challenge_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_id UUID NOT NULL,
  challenged_id UUID NOT NULL,
  challenger_deck INTEGER[] NOT NULL DEFAULT '{}'::integer[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  match_id UUID REFERENCES public.matches(id),
  is_ranked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE public.challenge_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view challenges involving them" ON public.challenge_invites
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

CREATE POLICY "Users can create challenges" ON public.challenge_invites
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can update challenges they're part of" ON public.challenge_invites
  FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- Global chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'global',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-deleted messages" ON public.chat_messages
  FOR SELECT USING (is_deleted = false OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Authenticated users can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Mods and admins can update messages" ON public.chat_messages
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Chat bans table for moderation
CREATE TABLE public.chat_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  banned_by UUID NOT NULL,
  reason TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mods and admins can view bans" ON public.chat_bans
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role) OR auth.uid() = user_id);

CREATE POLICY "Mods and admins can create bans" ON public.chat_bans
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Mods and admins can delete bans" ON public.chat_bans
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Enable realtime for chat and challenges
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;

-- Triggers for updated_at
CREATE TRIGGER update_friends_updated_at
  BEFORE UPDATE ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();