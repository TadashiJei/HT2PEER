using UnityEngine;
using HT2Peer;

[RequireComponent(typeof(HT2PeerView))]
public class BasicNetworkPlayer : MonoBehaviour
{
    private HT2PeerView networkView;
    private float moveSpeed = 5f;

    private void Start()
    {
        // Get the network view component
        networkView = GetComponent<HT2PeerView>();

        // Only enable input for the local player
        if (networkView.IsMine)
        {
            // Setup local player
            Camera.main.transform.SetParent(transform);
            Camera.main.transform.localPosition = new Vector3(0, 2, -5);
        }
    }

    private void Update()
    {
        // Only process input for the local player
        if (!networkView.IsMine) return;

        // Basic movement
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");
        
        Vector3 movement = new Vector3(horizontal, 0, vertical) * moveSpeed * Time.deltaTime;
        transform.Translate(movement);

        // The HT2PeerView component automatically syncs the transform to other players
    }
}
