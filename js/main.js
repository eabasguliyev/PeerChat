/// <reference path="agora-rtm-sdk-1.4.4.js" />

const APP_ID = "94aae1c3929b4454a20cb79eb740299e";
const uid = Math.floor(Math.random() * 10000).toString();
const token = null;

let client;
let channel;

let localStream;
let remoteStream;

let peerConnection;

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.1.google.com:19302", "stun:stun2.1.google.com:19302"],
    },
  ],
};

const localVideoPlayer = document.getElementById("user-1");
const remoteVideoPlayer = document.getElementById("user-2");

const init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);

  await client.login({ uid: uid, token: token });

  // index.html?room=main
  channel = client.createChannel("main");

  await channel.join();

  channel.on("MemberJoined", handleUserJoined);
  channel.on("MemberLeft", handleUserLeft);

  client.on("MessageFromPeer", handleMessageFromPeer);

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  localVideoPlayer.srcObject = localStream;
};

// Create offer
// Create answer
// Add answer

const createPeerConnection = async (memberId) => {
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();

  remoteVideoPlayer.srcObject = remoteStream;

  remoteVideoPlayer.style.display = "block";

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    localVideoPlayer.srcObject = localStream;
  }
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      console.log("New ICE candidate: ", event.candidate);

      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            value: event.candidate,
          }),
        },
        memberId
      );
    }
  };
};

const createOffer = async (memberId) => {
  await createPeerConnection(memberId);

  const offer = await peerConnection.createOffer();

  await peerConnection.setLocalDescription(offer);
  // when we set local description.
  // then onicecandidate event fires, and sent requests to stun servers,
  // if candidate exists then add every candidate to peerConnection instance

  console.log("Offer: ", offer);

  client.sendMessageToPeer(
    {
      text: JSON.stringify({
        type: "offer",
        value: offer,
      }),
    },
    memberId
  );
};

const createAnswer = async (memberId, offer) => {
  await createPeerConnection(memberId);

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();

  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    {
      text: JSON.stringify({
        type: "answer",
        value: answer,
      }),
    },
    memberId
  );
};

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    await peerConnection.setRemoteDescription(answer);
  }
};

const leaveChannel = async () => {
  await channel.leave();
  await client.logout();
};

// event listeners
window.addEventListener("beforeunload", leaveChannel);

// event handles
const handleUserJoined = async (memberId) => {
  console.log("A new user joined the channel: ", memberId);
  createOffer(memberId);
};

const handleMessageFromPeer = async (message, memberId) => {
  message = JSON.parse(message.text);

  if (message.type === "offer") {
    console.log("Offer received");
    createAnswer(memberId, message.value);
  } else if (message.type === "answer") {
    console.log("Answer received");
    addAnswer(message.value);
  } else if (message.type === "candidate") {
    if (peerConnection) {
      console.log("Candidate received");
      console.log("Candidate message: ", message.value);
      peerConnection.addIceCandidate(message.value);
    }
  }
};

const handleUserLeft = async (memberId) => {
  console.log("Member left: ", memberId);
  remoteVideoPlayer.style.display = "none";
};

init();
