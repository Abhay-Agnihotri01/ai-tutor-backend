import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import supabase from '../config/supabase.js';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback",
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    
    // First, try to find user by googleId
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('googleId', profile.id)
      .single();
    
    if (user) {
      return done(null, user);
    }
    
    // If not found by googleId, try to find by email (for existing accounts)
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      // Link Google account to existing user
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ 
          googleId: profile.id,
          avatar: profile.photos[0].value,
          isEmailVerified: true
        })
        .eq('email', email)
        .select('*')
        .single();
      
      if (error) {
        console.error('Error linking Google account:', error);
        return done(error, null);
      }
      
      console.log('Linked Google account to existing user:', email);
      return done(null, updatedUser);
    }
    
    // For completely new users, return profile data
    const userData = {
      googleId: profile.id,
      email: email,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      avatar: profile.photos[0].value,
      isNewUser: true
    };
    
    done(null, userData);
  } catch (error) {
    console.error('Passport Google Strategy Error:', error);
    done(error, null);
  }
}));

passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
}, async (payload, done) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.id)
      .single();
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
}));

export default passport;