class JitsiService {
  constructor() {
    this.jitsiDomain = process.env.JITSI_DOMAIN || 'meet.jit.si';
    this.appId = process.env.JITSI_APP_ID || '';
    this.apiKey = process.env.JITSI_API_KEY || '';

    console.log('Jitsi config:', {
      domain: this.jitsiDomain,
      usingFreeInstance: this.jitsiDomain === 'meet.jit.si'
    });
  }

  // Generate Jitsi meeting configuration
  generateMeetingConfig(roomName, participantName, participantId, role = 'participant') {
    try {
      // For meet.jit.si, use direct URL approach to avoid lobby issues
      const meetingUrl = `https://${this.jitsiDomain}/${roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=true&config.startWithVideoMuted=true&userInfo.displayName="${encodeURIComponent(participantName)}"`;
      
      const config = {
        roomName: roomName,
        domain: this.jitsiDomain,
        meetingUrl: meetingUrl,
        userInfo: {
          displayName: participantName,
          email: `${participantId}@lms.local`
        },
        configOverwrite: {
          startWithAudioMuted: true,
          startWithVideoMuted: true,
          prejoinPageEnabled: false,
          requireDisplayName: false,
          enableWelcomePage: false,
          enableClosePage: false,
          disableDeepLinking: true,
          enableUserRolesBasedOnToken: false,
          enableLobbyChat: false,
          enableInsecureRoomNameWarning: false,
          disableModeratorIndicator: false,
          enableNoAudioSignal: true,
          enableNoisyMicDetection: true,
          constraints: {
            video: {
              height: {
                ideal: 720,
                max: 1080,
                min: 240
              }
            }
          }
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          BRAND_WATERMARK_LINK: '',
          SHOW_POWERED_BY: false,
          DEFAULT_BACKGROUND: '#474747'
        }
      };
      
      console.log('Generated Jitsi config:', {
        roomName: config.roomName,
        domain: config.domain,
        displayName: config.userInfo.displayName,
        meetingUrl: config.meetingUrl
      });
      
      return config;
    } catch (error) {
      console.error('Error generating Jitsi config:', error);
      throw new Error('Failed to generate meeting configuration');
    }
  }

  // Create room metadata
  createRoomMetadata(liveClass, instructor) {
    return {
      title: liveClass.title,
      description: liveClass.description,
      courseId: liveClass.courseId,
      instructorId: liveClass.instructorId,
      instructorName: `${instructor.firstName} ${instructor.lastName}`,
      scheduledAt: liveClass.scheduledAt,
      duration: liveClass.duration,
      maxParticipants: liveClass.maxParticipants,
      isRecorded: liveClass.isRecorded,
      createdAt: new Date().toISOString()
    };
  }

  // Validate room name format
  validateRoomName(roomName) {
    // LiveKit room names must be alphanumeric with hyphens/underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(roomName) && roomName.length <= 63;
  }

  // Generate secure room name
  generateRoomName(prefix = 'live') {
    // Use a simple format that works better with free Jitsi
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    return `lms${prefix}${timestamp}${random}`;
  }

  // Get participant permissions based on role
  getParticipantPermissions(role) {
    const basePermissions = {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    };

    if (role === 'instructor') {
      return {
        ...basePermissions,
        roomAdmin: true,
        roomCreate: true,
        roomList: true,
        roomRecord: true,
      };
    }

    return basePermissions;
  }

  // Create participant metadata
  createParticipantMetadata(user, role) {
    return {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: role,
      avatar: user.avatar || null,
      joinedAt: new Date().toISOString()
    };
  }

  // Start recording (Jitsi uses client-side recording or Dropbox integration)
  async startRecording(roomName, recordingId) {
    try {
      console.log(`Starting Jitsi recording for room: ${roomName}`);
      
      // For Jitsi, recording is handled client-side or via Dropbox integration
      // Return a mock response that indicates recording should be started in the client
      const response = {
        recordingId: recordingId,
        status: 'client_recording',
        message: 'Recording should be started from Jitsi interface',
        roomName: roomName,
        startedAt: new Date().toISOString()
      };
      
      console.log('Jitsi recording initiated:', response);
      return response;
    } catch (error) {
      console.error('Error starting Jitsi recording:', error.message);
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  // Stop recording
  async stopRecording(recordingId) {
    try {
      console.log(`Stopping Jitsi recording: ${recordingId}`);
      
      const response = {
        recordingId: recordingId,
        status: 'stopped',
        message: 'Recording stopped from client',
        stoppedAt: new Date().toISOString()
      };
      
      return response;
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    }
  }

  // Get recording info
  async getRecordingInfo(recordingId) {
    try {
      // For Jitsi, recordings are typically saved to Dropbox or local storage
      // This would need to be implemented based on your recording storage solution
      return {
        recordingId: recordingId,
        status: 'completed',
        downloadUrl: null, // Would be set when recording is uploaded
        duration: null,
        fileSize: null
      };
    } catch (error) {
      console.error('Error getting recording info:', error);
      throw new Error('Failed to get recording info');
    }
  }

  // List room participants
  async listParticipants(roomName) {
    try {
      const response = await this.roomClient.listParticipants(roomName);
      return response;
    } catch (error) {
      console.error('Error listing participants:', error);
      throw new Error('Failed to list participants');
    }
  }

  // Remove participant from room
  async removeParticipant(roomName, participantId) {
    try {
      await this.roomClient.removeParticipant(roomName, participantId);
      return true;
    } catch (error) {
      console.error('Error removing participant:', error);
      throw new Error('Failed to remove participant');
    }
  }
}

export default new JitsiService();