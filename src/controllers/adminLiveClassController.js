// Admin token generation for live class access
export const generateAdminToken = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const adminId = req.user.id;
    const adminUser = req.user;

    console.log(`Admin ${adminId} requesting token for meeting ${meetingId}`);

    // Get live class details (no access check needed for admin)
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('meetingId', meetingId)
      .single();

    if (error || !liveClass) {
      console.log('Live class not found:', error);
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Get course and instructor info
    const { data: course } = await supabase
      .from('courses')
      .select('title, instructorId')
      .eq('id', liveClass.courseId)
      .single();

    const { data: instructor } = await supabase
      .from('users')
      .select('firstName, lastName')
      .eq('id', liveClass.instructorId)
      .single();

    // Generate admin meeting configuration
    const adminName = `Admin (${adminUser.firstName} ${adminUser.lastName})`;
    
    const meetingConfig = {
      roomName: meetingId,
      domain: process.env.JITSI_DOMAIN || '8x8.vc',
      userInfo: {
        displayName: adminName,
        email: 'admin@system.local'
      },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        prejoinPageEnabled: false,
        requireDisplayName: false,
        enableLobbyChat: false,
        enableUserRolesBasedOnToken: false,
        disableModeratorIndicator: false,
        enableAuthenticationUI: false
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
          'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
          'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
          'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
          'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone'
        ]
      }
    };

    // Log admin session
    try {
      await AdminSession.create({
        adminId,
        sessionType: 'live_class',
        targetId: liveClass.id,
        notes: `Admin accessed live class: ${liveClass.title}`
      });
    } catch (sessionError) {
      console.log('Session logging failed:', sessionError);
    }

    // Track activity
    try {
      await ActivityLog.create({
        userId: adminId,
        action: 'generate_admin_token',
        resource: 'live_class',
        resourceId: liveClass.id,
        details: {
          meetingId,
          liveClassTitle: liveClass.title,
          instructor
        }
      });
    } catch (activityError) {
      console.log('Activity logging failed:', activityError);
    }

    console.log('Admin token generated successfully');
    res.json({
      success: true,
      meetingConfig,
      roomName: meetingId,
      participantName: adminName,
      role: 'admin',
      liveClass: {
        ...liveClass,
        course,
        instructor
      }
    });
  } catch (error) {
    console.error('Error generating admin token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate admin access token'
    });
  }
};